// Print the server-confirmed payment, not the cleared checkout form.
// DOM textContent avoids interpreting restaurant/customer data as HTML.
export function printPaymentReceipt(payment: any, order?: any) {
  if (!payment?.id || payment.status !== "completed") throw new Error("Pago no confirmado");
  const money = (value: unknown) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value) || 0);
  document.getElementById("sirest-print-receipt")?.remove();
  const root = document.createElement("section");
  root.id = "sirest-print-receipt";
  const add = (tag: string, value: string, parent: HTMLElement = root) => {
    const node = document.createElement(tag);
    node.textContent = value;
    parent.appendChild(node);
    return node;
  };
  add("h1", "SIREST · Comprobante de pago");
  add("p", "Referencia: " + String(payment.id).replace(/^payment:/, ""));
  add("p", "Fecha: " + new Date(payment.createdAt).toLocaleString("es-CO", { timeZone: "America/Bogota" }));
  add("p", "Mesa: " + String(payment.tableNumber ?? "—"));
  add("p", "Método: " + String(payment.paymentMethod));
  if (payment.customerName) add("p", "Cliente: " + payment.customerName);
  const items = Array.isArray(order?.items) ? order.items : [];
  if (items.length) {
    const table = document.createElement("table");
    root.appendChild(table);
    const header = document.createElement("tr"); table.appendChild(header);
    ["Producto", "Cantidad", "Importe"].forEach(value => add("th", value, header));
    for (const item of items) {
      const row = document.createElement("tr"); table.appendChild(row);
      add("td", String(item.name ?? "Producto"), row);
      add("td", String(item.quantity), row);
      add("td", money(Number(item.price) * Number(item.quantity)), row);
    }
  }
  for (const [label, value] of [["Subtotal", payment.subtotal], ["Servicio", payment.service], ["Impuesto", payment.tax], ["Propina", payment.tip]]) add("p", label + ": " + money(value));
  add("p", "Total: " + money(payment.total)).className = "receipt-total";
  if (payment.paymentMethod === "efectivo") {
    add("p", "Recibido: " + money(payment.receivedAmount));
    add("p", "Cambio: " + money(payment.change));
  }
  add("p", "Comprobante interno de pago. No constituye factura electrónica fiscal.");
  document.body.appendChild(root);
  document.body.classList.add("sirest-printing");
  try { window.print(); }
  finally { document.body.classList.remove("sirest-printing"); root.remove(); }
}
