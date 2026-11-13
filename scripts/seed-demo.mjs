import { createClient } from "@supabase/supabase-js";
const url = process.env.API_URL;
const service = process.env.SERVICE_ROLE_KEY;
const password = process.env.SIREST_DEMO_PASSWORD;
if (!url || new URL(url).hostname !== "127.0.0.1" || new URL(url).port !== "54321" || !service || !password || password.length < 8) throw new Error("Requiere Supabase local, SERVICE_ROLE_KEY y contraseña de demostración de al menos 8 caracteres.");
const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const table = "kv_store_71783a73";
const roles = ["administrador", "mesero", "cocinero", "cajero", "cliente"];
const names = ["Administrador", "Mesero", "Cocina", "Caja", "Cliente"];
const { data, error } = await db.auth.admin.listUsers({page:1,perPage:1000});
if (error) throw error;
for (let i=0;i<roles.length;i++) {
  const email = "demo-" + roles[i] + "@sirest.local";
  const existing = data.users.find(u => u.email === email);
  let user = existing;
  if (!user) {
    const created = await db.auth.admin.createUser({email, password, email_confirm:true});
    if (created.error) throw created.error;
    user = created.data.user;
  }
  const result = await db.from(table).upsert([
    {key:"user_profile:"+user.id,value:{id:user.id,email,name:"Demo "+names[i],role:roles[i],active:true}},
    {key:"user_by_email:"+email,value:user.id}
  ],{onConflict:"key",ignoreDuplicates:true});
  if (result.error) throw result.error;
  console.log(email + (existing ? " (existente; conserva su contraseña)" : " (creado)"));
}
const tables = Array.from({length:8},(_,i)=>({key:"table:demo-"+(101+i),value:{id:"table:demo-"+(101+i),number:String(101+i),capacity:i<4?2:4,status:"disponible"}}));
const products = [
  ["Hamburguesa de la casa","Platos Fuertes",25000],
  ["Pasta al pesto","Platos Fuertes",24000],
  ["Pechuga a la plancha","Platos Fuertes",28000],
  ["Ensalada fresca","Entradas",14000],
  ["Papas rústicas","Entradas",12000],
  ["Limonada natural","Bebidas",8000],
  ["Jugo de mango","Bebidas",9000],
  ["Brownie artesanal","Postres",11000]
].map(([name,category,price],i)=>({key:"product:demo-"+(i+1),value:{id:"product:demo-"+(i+1),name,category,price,stock:30,minStock:5,image:""}}));
const seeded = await db.from(table).upsert([...tables,...products],{onConflict:"key",ignoreDuplicates:true});
if (seeded.error) throw seeded.error;
console.log("Demo listo: mesas 101–108 y 8 productos. No se modificaron datos existentes.");
