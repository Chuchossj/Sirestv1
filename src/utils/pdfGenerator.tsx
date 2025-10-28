import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

interface Product {
  name: string;
  cantidad: number;
  ingresos: number;
}

interface StaffPerformance {
  name: string;
  role: string;
  ventas: number;
  pedidos: number;
}

interface DailyReportData {
  date: string;
  period: string;
  totalSales: number;
  totalOrders: number;
  averageTicket: number;
  topProducts: Product[];
  staffPerformance: StaffPerformance[];
  paymentMethods: Array<{ name: string; value: number }>;
  criticalStock: number;
  outOfStock: number;
  normalStock: number;
}

export function generateDailyReport(data: DailyReportData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Colores corporativos de Globatech
  const colors = {
    primary: [11, 34, 64],      // #0B2240
    secondary: [91, 44, 144],    // #5B2C90
    accent: [242, 140, 27],      // #F28C1B
    highlight: [255, 210, 63],   // #FFD23F
  };

  // Encabezado
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, 35, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("SIREST - Globatech S.A.S.", pageWidth / 2, 15, { align: "center" });
  
  doc.setFontSize(16);
  doc.text("Reporte Diario de Operaciones", pageWidth / 2, 25, { align: "center" });

  // Información del reporte
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text(`Fecha: ${data.date}`, 14, 45);
  doc.text(`Período: ${data.period}`, 14, 50);
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, pageWidth - 14, 45, { align: "right" });

  // KPIs Principales
  let yPos = 60;
  doc.setFillColor(...colors.secondary);
  doc.rect(14, yPos, pageWidth - 28, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text("MÉTRICAS PRINCIPALES", pageWidth / 2, yPos + 5.5, { align: "center" });

  yPos += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  
  const kpis = [
    { label: "Ventas Totales:", value: `$${data.totalSales.toLocaleString('es-CO')}` },
    { label: "Pedidos Totales:", value: data.totalOrders.toString() },
    { label: "Ticket Promedio:", value: `$${data.averageTicket.toLocaleString('es-CO')}` },
  ];

  kpis.forEach((kpi, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 14 + (col * (pageWidth - 28) / 2);
    const y = yPos + (row * 8);
    
    doc.setFont(undefined, "bold");
    doc.text(kpi.label, x, y);
    doc.setFont(undefined, "normal");
    doc.text(kpi.value, x + 40, y);
  });

  // Productos más vendidos
  yPos += 25;
  doc.setFillColor(...colors.accent);
  doc.rect(14, yPos, pageWidth - 28, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text("PRODUCTOS MÁS VENDIDOS", pageWidth / 2, yPos + 5.5, { align: "center" });

  yPos += 10;
  if (data.topProducts.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Producto", "Cantidad", "Ingresos", "Promedio"]],
      body: data.topProducts.map(p => [
        p.name,
        p.cantidad.toString(),
        `${p.ingresos.toLocaleString('es-CO')}`,
        `${(p.ingresos / p.cantidad).toLocaleString('es-CO')}`
      ]),
      theme: "grid",
      headStyles: { fillColor: colors.secondary as [number, number, number], textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 }
    });
    yPos = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.text("No hay datos de productos vendidos", pageWidth / 2, yPos, { align: "center" });
    yPos += 10;
  }

  // Métodos de pago
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFillColor(...colors.accent);
  doc.rect(14, yPos, pageWidth - 28, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text("MÉTODOS DE PAGO", pageWidth / 2, yPos + 5.5, { align: "center" });

  yPos += 10;
  if (data.paymentMethods.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Método", "Porcentaje"]],
      body: data.paymentMethods.map(pm => [pm.name, `${pm.value}%`]),
      theme: "grid",
      headStyles: { fillColor: colors.secondary as [number, number, number], textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 }
    });
    yPos = doc.lastAutoTable.finalY + 10;
  }

  // Estado del inventario
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFillColor(...colors.secondary);
  doc.rect(14, yPos, pageWidth - 28, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text("ESTADO DEL INVENTARIO", pageWidth / 2, yPos + 5.5, { align: "center" });

  yPos += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`• Sin stock: ${data.outOfStock} productos`, 14, yPos);
  yPos += 6;
  doc.text(`• Stock crítico: ${data.criticalStock} productos`, 14, yPos);
  yPos += 6;
  doc.text(`• Stock normal: ${data.normalStock} productos`, 14, yPos);

  // Rendimiento del personal
  yPos += 10;
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFillColor(...colors.accent);
  doc.rect(14, yPos, pageWidth - 28, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text("RENDIMIENTO DEL PERSONAL", pageWidth / 2, yPos + 5.5, { align: "center" });

  yPos += 10;
  if (data.staffPerformance.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Empleado", "Rol", "Ventas", "Pedidos"]],
      body: data.staffPerformance.map(s => [
        s.name,
        s.role,
        `${s.ventas.toLocaleString('es-CO')}`,
        s.pedidos.toString()
      ]),
      theme: "grid",
      headStyles: { fillColor: colors.secondary as [number, number, number], textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 }
    });
  }

  // Pie de página
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
    doc.text(
      "SIREST - Sistema de Gestión de Restaurante",
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: "center" }
    );
  }

  return doc;
}

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  customerName?: string;
  customerPhone?: string;
  tableNumber?: number;
  waiterName?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  service?: number;
  tax: number;
  taxRate: number;
  tip?: number;
  total: number;
  paymentMethod: string;
}

export function generateInvoice(data: InvoiceData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Colores corporativos
  const colors = {
    primary: [11, 34, 64],
    secondary: [91, 44, 144],
    accent: [242, 140, 27],
  };

  // Encabezado
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text("SIREST", pageWidth / 2, 15, { align: "center" });
  
  doc.setFontSize(12);
  doc.text("Globatech S.A.S.", pageWidth / 2, 23, { align: "center" });
  doc.setFontSize(9);
  doc.text("NIT: 900.123.456-7", pageWidth / 2, 28, { align: "center" });
  doc.text("Calle Principal #123, Bogotá - Colombia", pageWidth / 2, 33, { align: "center" });
  doc.text("Tel: +57 300 123 4567", pageWidth / 2, 37, { align: "center" });

  // Información de la factura
  let yPos = 50;
  doc.setFillColor(...colors.accent);
  doc.rect(14, yPos, pageWidth - 28, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("FACTURA DE VENTA", pageWidth / 2, yPos + 5.5, { align: "center" });

  yPos += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  
  doc.setFont(undefined, "bold");
  doc.text("No. Factura:", 14, yPos);
  doc.setFont(undefined, "normal");
  doc.text(data.invoiceNumber, 45, yPos);
  
  doc.setFont(undefined, "bold");
  doc.text("Fecha:", pageWidth - 60, yPos);
  doc.setFont(undefined, "normal");
  doc.text(data.date, pageWidth - 35, yPos);

  yPos += 6;
  if (data.tableNumber) {
    doc.setFont(undefined, "bold");
    doc.text("Mesa:", 14, yPos);
    doc.setFont(undefined, "normal");
    doc.text(data.tableNumber.toString(), 45, yPos);
  }

  if (data.waiterName) {
    doc.setFont(undefined, "bold");
    doc.text("Mesero:", pageWidth - 60, yPos);
    doc.setFont(undefined, "normal");
    doc.text(data.waiterName, pageWidth - 35, yPos);
  }

  // Cliente
  if (data.customerName || data.customerPhone) {
    yPos += 8;
    doc.setFillColor(240, 240, 240);
    doc.rect(14, yPos, pageWidth - 28, 14, "F");
    yPos += 5;
    
    if (data.customerName) {
      doc.setFont(undefined, "bold");
      doc.text("Cliente:", 18, yPos);
      doc.setFont(undefined, "normal");
      doc.text(data.customerName, 38, yPos);
      yPos += 5;
    }
    
    if (data.customerPhone) {
      doc.setFont(undefined, "bold");
      doc.text("Teléfono:", 18, yPos);
      doc.setFont(undefined, "normal");
      doc.text(data.customerPhone, 38, yPos);
    }
    
    yPos += 8;
  } else {
    yPos += 8;
  }

  // Detalle de items
  autoTable(doc, {
    startY: yPos,
    head: [["Producto", "Cant.", "Precio Unit.", "Total"]],
    body: data.items.map(item => [
      item.name,
      item.quantity.toString(),
      `${item.price.toLocaleString('es-CO')}`,
      `${item.total.toLocaleString('es-CO')}`
    ]),
    theme: "grid",
    headStyles: { 
      fillColor: colors.secondary as [number, number, number], 
      textColor: [255, 255, 255],
      fontSize: 10
    },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' }
    },
    margin: { left: 14, right: 14 }
  });

  yPos = doc.lastAutoTable.finalY + 10;

  // Totales
  const totalsX = pageWidth - 70;
  doc.setFontSize(10);
  
  doc.text("Subtotal:", totalsX, yPos);
  doc.text(`$${data.subtotal.toLocaleString('es-CO')}`, pageWidth - 14, yPos, { align: "right" });
  
  yPos += 6;
  if (data.service && data.service > 0) {
    doc.text("Servicio (10%):", totalsX, yPos);
    doc.text(`$${data.service.toLocaleString('es-CO')}`, pageWidth - 14, yPos, { align: "right" });
    yPos += 6;
  }
  
  doc.text(`IVA (${data.taxRate}%):`, totalsX, yPos);
  doc.text(`$${data.tax.toLocaleString('es-CO')}`, pageWidth - 14, yPos, { align: "right" });
  
  yPos += 6;
  if (data.tip && data.tip > 0) {
    doc.text("Propina:", totalsX, yPos);
    doc.text(`$${data.tip.toLocaleString('es-CO')}`, pageWidth - 14, yPos, { align: "right" });
    yPos += 6;
  }
  
  yPos -= 4;
  doc.setLineWidth(0.5);
  doc.line(totalsX, yPos, pageWidth - 14, yPos);
  
  yPos += 6;
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("TOTAL:", totalsX, yPos);
  doc.text(`$${data.total.toLocaleString('es-CO')}`, pageWidth - 14, yPos, { align: "right" });

  yPos += 8;
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  doc.text(`Método de pago: ${data.paymentMethod}`, totalsX, yPos);

  // Mensaje de agradecimiento
  yPos += 15;
  doc.setFillColor(...colors.secondary);
  doc.rect(14, yPos, pageWidth - 28, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("¡Gracias por su preferencia!", pageWidth / 2, yPos + 5, { align: "center" });
  doc.text("Esperamos volver a verle pronto", pageWidth / 2, yPos + 9, { align: "center" });

  // Pie de página
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.text("Esta factura fue generada electrónicamente por SIREST", pageWidth / 2, footerY, { align: "center" });
  doc.text("Sistema de Gestión de Restaurante - Globatech S.A.S.", pageWidth / 2, footerY + 4, { align: "center" });

  return doc;
}
