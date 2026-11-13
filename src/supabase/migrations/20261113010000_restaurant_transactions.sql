-- SIREST V2: atomic restaurant operations. Retains the existing KV schema.
-- Service role only; the Edge Function authenticates and authorizes users.
create or replace function public.sirest_operation(action text, payload jsonb, actor uuid, actor_role text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  rec jsonb; old jsonb; item jsonb; product jsonb; items jsonb := '[]'::jsonb;
  k text; tid text; oid text; pid text; next_status text; method text;
  qty integer; subtotal numeric := 0; tax numeric; service numeric; tip numeric; total numeric; received numeric;
  ts text := to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  -- Serialize operations touching stock, orders, tables and payments.
  perform pg_advisory_xact_lock(71783002);
  if action = 'product_save' then
    k := payload->>'id';
    if k is null or k not like 'product:%' then raise exception 'Producto inválido' using errcode='22023'; end if;
    select value into old from kv_store_71783a73 where key=k for update;
    if coalesce(payload->>'mode','')='update' and old is null then raise exception 'Producto no encontrado' using errcode='P0002'; end if;
    rec := coalesce(old,'{}'::jsonb) || (payload - 'mode' - 'createdBy' - 'createdAt');
    if nullif(btrim(rec->>'name'),'') is null
       or jsonb_typeof(rec->'price') is distinct from 'number'
       or jsonb_typeof(rec->'stock') is distinct from 'number'
       or coalesce(jsonb_typeof(rec->'minStock'),'number') <> 'number'
       then raise exception 'Nombre, precio o inventario inválido' using errcode='22023'; end if;
    if (rec->>'price')::numeric <= 0 or (rec->>'price')::numeric <> trunc((rec->>'price')::numeric)
       or (rec->>'stock')::numeric < 0 or (rec->>'stock')::numeric <> trunc((rec->>'stock')::numeric)
       or coalesce((rec->>'minStock')::numeric,0)<0 or coalesce((rec->>'minStock')::numeric,0)<>trunc(coalesce((rec->>'minStock')::numeric,0))
       then raise exception 'Precio y existencias deben ser enteros válidos' using errcode='22023'; end if;
    rec := rec || jsonb_build_object('id',k,'name',btrim(rec->>'name'),'updatedAt',ts,'updatedBy',actor);
    if old is null then rec := rec || jsonb_build_object('createdAt',ts,'createdBy',actor); end if;
    insert into kv_store_71783a73 values(k,rec) on conflict(key) do update set value=excluded.value;
    return rec;
  elsif action = 'product_delete' then
    k := payload->>'id';
    if k is null or k not like 'product:%' then raise exception 'Producto inválido' using errcode='22023'; end if;
    delete from kv_store_71783a73 where key=k;
    if not found then raise exception 'Producto no encontrado' using errcode='P0002'; end if;
    return '{}'::jsonb;
  elsif action = 'order_create' then
    if jsonb_typeof(payload->'items') is distinct from 'array' then raise exception 'Pedido sin productos' using errcode='22023'; end if;
    if jsonb_array_length(payload->'items')=0 or jsonb_array_length(payload->'items')>100 then raise exception 'Cantidad de líneas inválida' using errcode='22023'; end if;
    tid := payload->>'tableId';
    if tid = 'online-order' and actor_role='cliente' then rec := jsonb_build_object('number','Online');
    else
      if tid is null or tid not like 'table:%' then raise exception 'Mesa inválida' using errcode='22023'; end if;
      select value into rec from kv_store_71783a73 where key=tid for update;
      if rec is null then raise exception 'Mesa no encontrada' using errcode='P0002'; end if;
      if rec->>'status' not in ('disponible','ocupada') then raise exception 'Mesa no disponible' using errcode='P0001'; end if;
      if actor_role='cliente' and rec->>'status' <> 'disponible' then raise exception 'Mesa no disponible' using errcode='P0001'; end if;
    end if;
    oid := 'order:'||gen_random_uuid()::text;
    for item in select value from jsonb_array_elements(payload->'items') loop
      pid := item->>'productId';
      if pid is null or pid not like 'product:%' or jsonb_typeof(item->'quantity') is distinct from 'number' then raise exception 'Producto o cantidad inválidos' using errcode='22023'; end if;
      if (item->>'quantity')::numeric < 1 or (item->>'quantity')::numeric > 10000 or (item->>'quantity')::numeric <> trunc((item->>'quantity')::numeric) then raise exception 'Cantidad inválida' using errcode='22023'; end if;
      qty := (item->>'quantity')::integer;
      select value into product from kv_store_71783a73 where key=pid for update;
      if product is null then raise exception 'Producto no encontrado' using errcode='P0002'; end if;
      if coalesce((product->>'stock')::numeric,0)<qty then raise exception 'Stock insuficiente: %',product->>'name' using errcode='P0001'; end if;
      if coalesce((product->>'price')::numeric,0)<=0 then raise exception 'Precio de producto inválido' using errcode='22023'; end if;
      subtotal := subtotal + (product->>'price')::numeric*qty;
      items := items || jsonb_build_array(jsonb_build_object('productId',pid,'name',product->>'name','category',product->>'category','price',(product->>'price')::numeric,'quantity',qty,'notes',coalesce(item->>'notes','')));
      update kv_store_71783a73 set value=product||jsonb_build_object('stock',(product->>'stock')::numeric-qty,'updatedAt',ts) where key=pid;
    end loop;
    old := jsonb_build_object('id',oid,'tableId',tid,'tableNumber',rec->>'number','items',items,'subtotal',subtotal,'total',subtotal,'status','pending','createdAt',ts,'createdBy',actor,'notes',coalesce(payload->>'notes',''));
    if actor_role='cliente' then old := old||jsonb_build_object('customerId',actor,'customerEmail',payload->>'customerEmail','customerName',payload->>'customerName','orderType','cliente'); end if;
    insert into kv_store_71783a73 values(oid,old);
    if tid like 'table:%' then update kv_store_71783a73 set value=rec||jsonb_build_object('status','ocupada','updatedAt',ts) where key=tid; end if;
    k := 'alert:'||gen_random_uuid()::text;
    insert into kv_store_71783a73 values(k,jsonb_build_object('id',k,'type','new_order','message','Nuevo pedido para Mesa '||(rec->>'number'),'orderId',oid,'createdAt',ts,'read',false));
    return old;
  elsif action = 'order_status' then
    oid := payload->>'id'; next_status := payload->>'status';
    select value into old from kv_store_71783a73 where key=oid and key like 'order:%' for update;
    if old is null then raise exception 'Pedido no encontrado' using errcode='P0002'; end if;
    if next_status is null or not (
      (actor_role in ('cocinero','administrador') and ((old->>'status'='pending' and next_status='preparing') or (old->>'status'='preparing' and next_status in ('pending','ready'))))
      or (actor_role in ('mesero','administrador') and old->>'status'='ready' and next_status='served')
    ) then raise exception 'Transición de pedido no permitida' using errcode='P0001'; end if;
    rec := old||jsonb_build_object('status',next_status,'updatedAt',ts,'updatedBy',actor);
    update kv_store_71783a73 set value=rec where key=oid;
    if next_status='ready' then
      k := 'alert:'||gen_random_uuid()::text;
      insert into kv_store_71783a73 values(k,jsonb_build_object('id',k,'type','order_ready','message','Pedido listo para Mesa '||(old->>'tableNumber'),'orderId',oid,'createdAt',ts,'read',false));
    end if;
    return rec;
  elsif action = 'payment_create' then
    oid := payload->>'orderId'; method := payload->>'paymentMethod';
    select value into old from kv_store_71783a73 where key=oid and key like 'order:%' for update;
    if old is null then raise exception 'Pedido no encontrado' using errcode='P0002'; end if;
    if old->>'status'='paid' or exists(select 1 from kv_store_71783a73 where key like 'payment:%' and value->>'orderId'=oid) then raise exception 'El pedido ya fue pagado' using errcode='P0001'; end if;
    if old->>'status' not in ('ready','served') then raise exception 'Pedido no listo para cobrar' using errcode='P0001'; end if;
    if method is null or method not in ('efectivo','tarjeta','transferencia','qr') then raise exception 'Método de pago inválido' using errcode='22023'; end if;
    subtotal := coalesce((old->>'subtotal')::numeric,(old->>'total')::numeric,0);
    if subtotal<=0 then raise exception 'Subtotal inválido' using errcode='22023'; end if;
    -- Preserve the prototype's existing pricing policy; not a fiscal engine.
    service := round(subtotal*0.10); tax := round(subtotal*0.19);
    if coalesce(jsonb_typeof(payload->'tip'),'number')<>'number' then raise exception 'Propina inválida' using errcode='22023'; end if;
    tip := coalesce((payload->>'tip')::numeric,0);
    if tip<0 or tip<>trunc(tip) then raise exception 'Propina inválida' using errcode='22023'; end if;
    total := subtotal+service+tax+tip;
    if method='efectivo' then
      if jsonb_typeof(payload->'receivedAmount') is distinct from 'number' then raise exception 'Monto recibido requerido' using errcode='22023'; end if;
      received := (payload->>'receivedAmount')::numeric;
      if received<total then raise exception 'Efectivo insuficiente' using errcode='22023'; end if;
    else received := total; end if;
    k := 'payment:'||gen_random_uuid()::text;
    rec := jsonb_build_object('id',k,'orderId',oid,'tableNumber',old->>'tableNumber','paymentMethod',method,'subtotal',subtotal,'service',service,'tax',tax,'tip',tip,'total',total,'receivedAmount',received,'change',received-total,'notes',coalesce(payload->>'notes',''),'waiterName',coalesce(payload->>'waiterName',''),'customerName',coalesce(old->>'customerName',''),'customerPhone',coalesce(old->>'customerPhone',''),'createdAt',ts,'createdBy',actor,'status','completed');
    insert into kv_store_71783a73 values(k,rec);
    update kv_store_71783a73 set value=old||jsonb_build_object('status','paid','paidAt',ts) where key=oid;
    tid := old->>'tableId';
    if tid like 'table:%' and not exists(select 1 from kv_store_71783a73 where key like 'order:%' and value->>'tableId'=tid and value->>'status' <> 'paid') then
      update kv_store_71783a73 set value=value||jsonb_build_object('status','disponible','waiter',null,'updatedAt',ts) where key=tid;
    end if;
    return rec;
  elsif action = 'table_update' then
    tid := payload->>'id';
    select value into old from kv_store_71783a73 where key=tid and key like 'table:%' for update;
    if old is null then raise exception 'Mesa no encontrada' using errcode='P0002'; end if;
    next_status := payload->>'status';
    if next_status is null or next_status not in ('disponible','ocupada','reservada','pagando') then raise exception 'Estado de mesa inválido' using errcode='22023'; end if;
    if next_status='disponible' and exists(select 1 from kv_store_71783a73 where key like 'order:%' and value->>'tableId'=tid and value->>'status'<>'paid') then raise exception 'Mesa con pedidos pendientes' using errcode='P0001'; end if;
    rec := old||jsonb_build_object('status',next_status,'updatedAt',ts,'updatedBy',actor);
    update kv_store_71783a73 set value=rec where key=tid;
    return rec;
  end if;
  raise exception 'Operación inválida' using errcode='22023';
end;
$$;
revoke all on function public.sirest_operation(text,jsonb,uuid,text) from public, anon, authenticated;
grant execute on function public.sirest_operation(text,jsonb,uuid,text) to service_role;
