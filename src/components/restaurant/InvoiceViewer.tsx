import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { Download, Printer, X } from "lucide-react";
import { generateInvoice } from "../../utils/pdfGenerator";
import { useRealtimeData } from "../../utils/useRealtimeData";

interface InvoiceViewerProps {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
}

interface Order {
  id: string;
  items: Array<{ 
    productId?: string;
    name: string; 
    quantity: number; 
    price: number;
  }>;
  total: number;
  status: string;
  tableNumber?: number;
  createdAt: string;
  createdBy: string;
  customerName?: string;
  customerPhone?: string;
}

interface Payment {
  id: string;
  orderId: string;
  subtotal?: number;
  service?: number;
  tax?: number;
  tip?: number;
  total: number;
  paymentMethod: string;
  createdAt: string;
}

interface User {
  id: string;
  name: string;
  role: string;
}

export function InvoiceViewer({ orderId, open, onClose }: InvoiceViewerProps) {
  const [orderData, setOrderData] = useState<Order | null>(null);
  const [paymentData, setPaymentData] = useState<Payment | null>(null);
  const [waiterData, setWaiterData] = useState<User | null>(null);
  const accessToken = localStorage.getItem("accessToken");

  // Colores corporativos
  const colors = {
    primary: "#0B2240",
    secondary: "#5B2C90",
    accent: "#F28C1B",
    highlight: "#FFD23F",
  };

  const { data: ordersData } = useRealtimeData<{ success: boolean; orders: Order[] }>({
    endpoint: "/orders",
    accessToken: accessToken || undefined,
    refreshInterval: 3000,
  });

  const { data: paymentsData } = useRealtimeData<{ success: boolean; payments: Payment[] }>({
    endpoint: "/payments",
    accessToken: accessToken || undefined,
    refreshInterval: 3000,
  });

  const { data: usersData } = useRealtimeData<{ success: boolean; users: User[] }>({
    endpoint: "/users",
    accessToken: accessToken || undefined,
    refreshInterval: 5000,
  });

  useEffect(() => {
    if (!orderId || !open) {
      setOrderData(null);
      setPaymentData(null);
      setWaiterData(null);
      return;
    }

    console.log('Buscando orden:', orderId);
    console.log('Órdenes disponibles:', ordersData?.orders);

    // Buscar la orden
    const order = ordersData?.orders?.find(o => o.id === orderId);
    console.log('Orden encontrada:', order);
    
    if (order) {
      setOrderData(order);

      // Buscar el pago asociado
      const payment = paymentsData?.payments?.find(p => p.orderId === orderId);
      console.log('Pago encontrado:', payment);
      if (payment) {
        setPaymentData(payment);
      }

      // Buscar información del mesero
      const waiter = usersData?.users?.find(u => u.id === order.createdBy);
      console.log('Mesero encontrado:', waiter);
      if (waiter) {
        setWaiterData(waiter);
      }
    } else {
      console.log('No se encontró la orden con ID:', orderId);
    }
  }, [orderId, open, ordersData, paymentsData, usersData]);

  const handlePrint = () => {
    if (!orderData) {
      console.error('No hay datos de orden para imprimir');
      return;
    }

    try {
      // Si el pago tiene los datos detallados, usarlos
      // Si no, calcularlos desde el total (total incluye subtotal + servicio 10% + IVA 19%)
      let subtotal, service, tax, tip;
      
      if (paymentData && paymentData.subtotal) {
        // Usar datos del pago si están disponibles
        subtotal = paymentData.subtotal || 0;
        service = paymentData.service || 0;
        tax = paymentData.tax || 0;
        tip = paymentData.tip || 0;
      } else {
        // Calcular desde el total (total = subtotal * 1.29 = subtotal + 10% servicio + 19% IVA)
        subtotal = orderData.total / 1.29;
        service = subtotal * 0.10;
        tax = subtotal * 0.19;
        tip = 0;
      }

      const invoiceData = {
        invoiceNumber: orderData.id.replace('order:', 'INV-'),
        date: new Date(orderData.createdAt).toLocaleString('es-CO'),
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        tableNumber: orderData.tableNumber,
        waiterName: waiterData?.name,
        items: orderData.items.map(item => ({
          name: item.name || 'Producto sin nombre',
          quantity: item.quantity || 1,
          price: item.price || 0,
          total: (item.price || 0) * (item.quantity || 1),
        })),
        subtotal,
        service,
        tax,
        taxRate: 19,
        tip,
        total: orderData.total,
        paymentMethod: paymentData?.paymentMethod || 'Efectivo',
      };

      const doc = generateInvoice(invoiceData);
      
      // Abrir en nueva ventana para imprimir
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(url);
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } catch (error) {
      console.error('Error al imprimir factura:', error);
    }
  };

  const handleDownload = () => {
    if (!orderData) {
      console.error('No hay datos de orden para descargar');
      return;
    }

    try {
      // Si el pago tiene los datos detallados, usarlos
      // Si no, calcularlos desde el total (total incluye subtotal + servicio 10% + IVA 19%)
      let subtotal, service, tax, tip;
      
      if (paymentData && paymentData.subtotal) {
        // Usar datos del pago si están disponibles
        subtotal = paymentData.subtotal || 0;
        service = paymentData.service || 0;
        tax = paymentData.tax || 0;
        tip = paymentData.tip || 0;
      } else {
        // Calcular desde el total (total = subtotal * 1.29 = subtotal + 10% servicio + 19% IVA)
        subtotal = orderData.total / 1.29;
        service = subtotal * 0.10;
        tax = subtotal * 0.19;
        tip = 0;
      }

      const invoiceData = {
        invoiceNumber: orderData.id.replace('order:', 'INV-'),
        date: new Date(orderData.createdAt).toLocaleString('es-CO'),
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        tableNumber: orderData.tableNumber,
        waiterName: waiterData?.name,
        items: orderData.items.map(item => ({
          name: item.name || 'Producto sin nombre',
          quantity: item.quantity || 1,
          price: item.price || 0,
          total: (item.price || 0) * (item.quantity || 1),
        })),
        subtotal,
        service,
        tax,
        taxRate: 19,
        tip,
        total: orderData.total,
        paymentMethod: paymentData?.paymentMethod || 'Efectivo',
      };

      const doc = generateInvoice(invoiceData);
      doc.save(`factura-${invoiceData.invoiceNumber}.pdf`);
    } catch (error) {
      console.error('Error al descargar factura:', error);
    }
  };

  if (!orderData) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Factura</DialogTitle>
            <DialogDescription>
              Cargando información de la factura...
            </DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center text-gray-500">
            {orderId ? 'Buscando orden...' : 'No se especificó ID de orden'}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Si no tiene total, intentar calcularlo de los items
  if (typeof orderData.total !== 'number') {
    const calculatedTotal = orderData.items?.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 1), 
      0
    ) || 0;
    
    if (calculatedTotal === 0) {
      return (
        <Dialog open={open} onOpenChange={onClose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Factura</DialogTitle>
              <DialogDescription>
                Error: Datos de factura incompletos
              </DialogDescription>
            </DialogHeader>
            <div className="py-8 text-center text-gray-500">
              No se pudo calcular el total de la orden
            </div>
          </DialogContent>
        </Dialog>
      );
    }
    
    // Usar el total calculado
    orderData.total = calculatedTotal;
  }

  // Calcular totales correctamente
  let subtotal, service, tax, tip;
  
  if (paymentData && paymentData.subtotal) {
    // Usar datos del pago si están disponibles
    subtotal = paymentData.subtotal || 0;
    service = paymentData.service || 0;
    tax = paymentData.tax || 0;
    tip = paymentData.tip || 0;
  } else {
    // Calcular desde el total (total = subtotal * 1.29 = subtotal + 10% servicio + 19% IVA)
    subtotal = orderData.total / 1.29;
    service = subtotal * 0.10;
    tax = subtotal * 0.19;
    tip = 0;
  }

  console.log('Renderizando factura con datos:', {
    orderData,
    paymentData,
    waiterData,
    subtotal,
    service,
    tax,
    tip,
    total: orderData.total
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle style={{ color: colors.primary }}>Factura de Venta</DialogTitle>
              <DialogDescription>
                No. {orderData.id?.replace('order:', 'INV-') || 'Sin número'}
              </DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <Card>
          <CardContent className="p-6">
            {/* Encabezado de la empresa */}
            <div className="text-center mb-6 p-6 rounded-lg" style={{ backgroundColor: colors.primary }}>
              <h2 className="text-3xl text-white">SIREST</h2>
              <p className="text-sm text-white opacity-90">Sistema de Gestión de Restaurante</p>
              <p className="text-sm text-white mt-2">Globatech S.A.S.</p>
              <p className="text-xs text-white opacity-75">NIT: 900.123.456-7</p>
              <p className="text-xs text-white opacity-75">Calle Principal #123, Bogotá - Colombia</p>
              <p className="text-xs text-white opacity-75">Tel: +57 300 123 4567</p>
            </div>

            <Separator className="my-4" />

            {/* Información de la factura */}
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <p className="text-gray-600">Fecha:</p>
                <p>{new Date(orderData.createdAt).toLocaleString('es-CO')}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-600">No. Factura:</p>
                <p>{orderData.id.replace('order:', 'INV-')}</p>
              </div>
              {orderData.tableNumber && (
                <div>
                  <p className="text-gray-600">Mesa:</p>
                  <p>Mesa {orderData.tableNumber}</p>
                </div>
              )}
              {waiterData && (
                <div className="text-right">
                  <p className="text-gray-600">Atendido por:</p>
                  <p>{waiterData.name}</p>
                </div>
              )}
            </div>

            {/* Información del cliente */}
            {(orderData.customerName || orderData.customerPhone) && (
              <>
                <Separator className="my-4" />
                <div className="bg-gray-50 p-3 rounded-lg mb-4">
                  <p className="text-sm text-gray-600 mb-1">Cliente:</p>
                  {orderData.customerName && <p className="text-sm">{orderData.customerName}</p>}
                  {orderData.customerPhone && <p className="text-sm">{orderData.customerPhone}</p>}
                </div>
              </>
            )}

            <Separator className="my-4" />

            {/* Detalle de items */}
            <div className="mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Producto</th>
                    <th className="text-center py-2">Cant.</th>
                    <th className="text-right py-2">Precio</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orderData.items.map((item, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="py-2">{item.name || 'Producto sin nombre'}</td>
                      <td className="text-center py-2">{item.quantity || 1}</td>
                      <td className="text-right py-2">${(item.price || 0).toLocaleString('es-CO')}</td>
                      <td className="text-right py-2">
                        ${((item.price || 0) * (item.quantity || 1)).toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Separator className="my-4" />

            {/* Totales */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span>${subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {service > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Servicio (10%):</span>
                  <span>${service.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">IVA (19%):</span>
                <span>${tax.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {tip > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Propina:</span>
                  <span>${tip.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-lg" style={{ color: colors.primary }}>Total:</span>
                <span className="text-xl" style={{ color: colors.primary }}>
                  ${orderData.total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {paymentData && (
                <div className="flex justify-between pt-2">
                  <span className="text-gray-600">Método de pago:</span>
                  <Badge style={{ backgroundColor: colors.accent, color: 'white' }}>
                    {paymentData.paymentMethod}
                  </Badge>
                </div>
              )}
            </div>

            {/* Mensaje de agradecimiento */}
            <div className="mt-6 p-4 rounded-lg text-center text-white" style={{ backgroundColor: colors.secondary }}>
              <p className="text-sm">¡Gracias por su preferencia!</p>
              <p className="text-xs">Esperamos volver a verle pronto</p>
            </div>
          </CardContent>
        </Card>

        {/* Botones de acción */}
        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Descargar PDF
          </Button>
          <Button onClick={handlePrint} style={{ backgroundColor: colors.accent }}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
