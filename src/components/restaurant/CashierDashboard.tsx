import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { 
  CreditCard, 
  DollarSign, 
  Receipt, 
  Calculator,
  Percent,
  Users,
  Clock,
  CheckCircle,
  Printer,
  Smartphone,
  Banknote,
  Zap,
  FileText,
  TrendingUp,
  Eye,
  Mail,
  Download,
  Send
} from "lucide-react";
import { useRealtimeData } from "../../utils/useRealtimeData";
import { InvoiceViewer } from "./InvoiceViewer";
import { generateInvoice } from "../../utils/pdfGenerator";
import { toast } from "sonner@2.0.3";

interface OrderItem {
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

interface Order {
  id: string;
  items: OrderItem[];
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
  orderId?: string;
  total: number;
  paymentMethod: string;
  createdAt: string;
  createdBy: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}



export function CashierDashboard() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [receivedAmount, setReceivedAmount] = useState<string>("");
  const [tipAmount, setTipAmount] = useState<string>("");
  const [customerNotes, setCustomerNotes] = useState<string>("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [showInvoiceViewer, setShowInvoiceViewer] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState<string>("Factura SIREST - Globatech");
  const [emailMessage, setEmailMessage] = useState<string>("Adjunto encontrará su factura. Gracias por su preferencia.");
  const [sendingEmail, setSendingEmail] = useState(false);
  const accessToken = localStorage.getItem("accessToken");

  // Colores corporativos de Globatech
  const colors = {
    primary: "#0B2240",
    secondary: "#5B2C90",
    accent: "#F28C1B",
    highlight: "#FFD23F",
  };

  // Obtener datos en tiempo real
  const { data: ordersData, loading: loadingOrders } = useRealtimeData<{ success: boolean; orders: Order[] }>({
    endpoint: "/orders",
    accessToken: accessToken || undefined,
    refreshInterval: 3000,
  });

  const { data: paymentsData, loading: loadingPayments } = useRealtimeData<{ success: boolean; payments: Payment[] }>({
    endpoint: "/payments",
    accessToken: accessToken || undefined,
    refreshInterval: 3000,
  });

  const { data: usersData } = useRealtimeData<{ success: boolean; users: User[] }>({
    endpoint: "/users",
    accessToken: accessToken || undefined,
    refreshInterval: 5000,
  });

  // Filtrar órdenes listas para cobrar
  const pendingOrders = (ordersData?.orders || []).filter(
    order => order.status === "ready" || order.status === "listo"
  );

  // Transacciones del día
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const recentTransactions = (paymentsData?.payments || [])
    .filter(p => new Date(p.createdAt) >= today)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const calculateTotals = (order: Order) => {
    const subtotal = order.total || 0;
    const tax = subtotal * 0.19; // 19% IVA Colombia
    const tip = parseFloat(tipAmount) || 0;
    const total = subtotal + tax + tip;
    
    return { subtotal, tax, tip, total };
  };

  const calculateChange = (order: Order) => {
    const { total } = calculateTotals(order);
    const received = parseFloat(receivedAmount) || 0;
    return Math.max(0, received - total);
  };

  const processPayment = async () => {
    if (!selectedOrder || !paymentMethod) {
      toast.error("Selecciona una orden y un método de pago");
      return;
    }
    
    try {
      const { total } = calculateTotals(selectedOrder);
      
      const paymentData = {
        orderId: selectedOrder.id,
        total,
        paymentMethod,
        notes: customerNotes,
        tipAmount: parseFloat(tipAmount) || 0,
      };

      const response = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/make-server-71783a73/payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(paymentData),
        }
      );

      if (response.ok) {
        const orderId = selectedOrder.id;
        toast.success("Pago procesado exitosamente", {
          description: "¿Deseas imprimir la factura ahora?",
          action: {
            label: "Imprimir",
            onClick: () => handlePrintInvoice(orderId),
          },
        });
        
        // Actualizar estado de la orden
        await fetch(
          `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/make-server-71783a73/orders/${selectedOrder.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ status: "pagado" }),
          }
        );

        // Mostrar automáticamente la factura
        setTimeout(() => {
          handleViewInvoice(orderId);
        }, 500);

        // Resetear formulario
        setSelectedOrder(null);
        setPaymentMethod("");
        setReceivedAmount("");
        setTipAmount("");
        setCustomerNotes("");
      } else {
        toast.error("Error al procesar el pago");
      }
    } catch (error) {
      console.error("Error procesando pago:", error);
      toast.error("Error al procesar el pago");
    }
  };

  const handleViewInvoice = (orderId: string) => {
    console.log('Visualizando factura para orden:', orderId);
    setSelectedInvoiceId(orderId);
    setShowInvoiceViewer(true);
  };

  const handlePrintInvoice = (orderId: string) => {
    try {
      const order = ordersData?.orders?.find(o => o.id === orderId);
      const payment = paymentsData?.payments?.find(p => p.orderId === orderId);
      const waiter = usersData?.users?.find(u => u.id === order?.createdBy);

      if (!order) {
        toast.error("No se encontró la orden");
        return;
      }

      const taxRate = 19;
      const subtotal = order.total / (1 + taxRate / 100);
      const tax = order.total - subtotal;

      const invoiceData = {
        invoiceNumber: order.id.replace('order:', 'INV-'),
        date: new Date(order.createdAt).toLocaleString('es-CO'),
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        tableNumber: order.tableNumber,
        waiterName: waiter?.name,
        items: order.items.map(item => ({
          name: item.name || 'Producto sin nombre',
          quantity: item.quantity || 1,
          price: item.price || 0,
          total: (item.price || 0) * (item.quantity || 1),
        })),
        subtotal,
        tax,
        taxRate,
        total: order.total,
        paymentMethod: payment?.paymentMethod || 'Efectivo',
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
      toast.success("Factura enviada a impresión");
    } catch (error) {
      console.error('Error al imprimir factura:', error);
      toast.error("Error al imprimir la factura");
    }
  };

  const handleDownloadInvoice = (orderId: string) => {
    try {
      const order = ordersData?.orders?.find(o => o.id === orderId);
      const payment = paymentsData?.payments?.find(p => p.orderId === orderId);
      const waiter = usersData?.users?.find(u => u.id === order?.createdBy);

      if (!order) {
        toast.error("No se encontró la orden");
        return;
      }

      const taxRate = 19;
      const subtotal = order.total / (1 + taxRate / 100);
      const tax = order.total - subtotal;

      const invoiceData = {
        invoiceNumber: order.id.replace('order:', 'INV-'),
        date: new Date(order.createdAt).toLocaleString('es-CO'),
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        tableNumber: order.tableNumber,
        waiterName: waiter?.name,
        items: order.items.map(item => ({
          name: item.name || 'Producto sin nombre',
          quantity: item.quantity || 1,
          price: item.price || 0,
          total: (item.price || 0) * (item.quantity || 1),
        })),
        subtotal,
        tax,
        taxRate,
        total: order.total,
        paymentMethod: payment?.paymentMethod || 'Efectivo',
      };

      const doc = generateInvoice(invoiceData);
      doc.save(`factura-${invoiceData.invoiceNumber}.pdf`);
      toast.success("Factura descargada exitosamente");
    } catch (error) {
      console.error('Error al descargar factura:', error);
      toast.error("Error al descargar la factura");
    }
  };

  const handleEmailInvoice = (orderId: string) => {
    const order = ordersData?.orders?.find(o => o.id === orderId);
    if (order?.customerPhone) {
      setEmailAddress(order.customerPhone); // Se puede cambiar por email si existe
    }
    setSelectedInvoiceId(orderId);
    setShowEmailDialog(true);
  };

  const handleSendEmail = async () => {
    if (!emailAddress || !selectedInvoiceId) {
      toast.error("Por favor ingrese un correo electrónico válido");
      return;
    }

    setSendingEmail(true);
    try {
      const order = ordersData?.orders?.find(o => o.id === selectedInvoiceId);
      const payment = paymentsData?.payments?.find(p => p.orderId === selectedInvoiceId);
      const waiter = usersData?.users?.find(u => u.id === order?.createdBy);

      if (!order) {
        toast.error("No se encontró la orden");
        return;
      }

      const taxRate = 19;
      const subtotal = order.total / (1 + taxRate / 100);
      const tax = order.total - subtotal;

      const invoiceData = {
        invoiceNumber: order.id.replace('order:', 'INV-'),
        date: new Date(order.createdAt).toLocaleString('es-CO'),
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        tableNumber: order.tableNumber,
        waiterName: waiter?.name,
        items: order.items.map(item => ({
          name: item.name || 'Producto sin nombre',
          quantity: item.quantity || 1,
          price: item.price || 0,
          total: (item.price || 0) * (item.quantity || 1),
        })),
        subtotal,
        tax,
        taxRate,
        total: order.total,
        paymentMethod: payment?.paymentMethod || 'Efectivo',
      };

      const doc = generateInvoice(invoiceData);
      const pdfBase64 = doc.output('dataurlstring').split(',')[1];

      // Enviar email a través del servidor
      const response = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/make-server-71783a73/send-invoice-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            to: emailAddress,
            subject: emailSubject,
            message: emailMessage,
            invoiceNumber: invoiceData.invoiceNumber,
            pdfBase64,
          }),
        }
      );

      if (response.ok) {
        toast.success("Factura enviada por correo electrónico exitosamente");
        setShowEmailDialog(false);
        setEmailAddress("");
      } else {
        // Si el endpoint no existe, mostrar mensaje informativo
        toast.info("Funcionalidad de correo electrónico en desarrollo. Puedes descargar la factura.");
        setShowEmailDialog(false);
      }
    } catch (error) {
      console.error('Error al enviar email:', error);
      toast.info("Por ahora, puedes descargar la factura para enviarla manualmente");
      setShowEmailDialog(false);
    } finally {
      setSendingEmail(false);
    }
  };

  const todaysSales = recentTransactions.reduce((sum, payment) => sum + (payment.total || 0), 0);
  const todaysTransactions = recentTransactions.length;
  const loading = loadingOrders || loadingPayments;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl" style={{ color: colors.primary }}>Panel de Caja</h1>
          <p className="text-gray-600 mt-1">
            Procesamiento de pagos y facturación
          </p>
        </div>
        <div className="flex items-center space-x-2 mt-4 lg:mt-0">
          <Badge variant="outline" className="bg-green-50 border-green-200" style={{ color: colors.secondary }}>
            <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: colors.secondary }}></div>
            Caja Abierta
          </Badge>
          <Badge style={{ backgroundColor: colors.accent, color: "white" }}>
            {loading ? "Actualizando..." : `${pendingOrders.length} órdenes`}
          </Badge>
        </div>
      </div>

      {/* Estadísticas del día */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Ventas del Día</CardTitle>
            <DollarSign className="h-4 w-4" style={{ color: colors.secondary }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl" style={{ color: colors.primary }}>
              ${todaysSales.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-gray-600">
              {todaysTransactions} transacciones
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Transacciones</CardTitle>
            <Receipt className="h-4 w-4" style={{ color: colors.accent }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl" style={{ color: colors.primary }}>{todaysTransactions}</div>
            <div className="text-xs text-gray-600">
              Promedio: <span>${todaysTransactions > 0 ? (todaysSales / todaysTransactions).toLocaleString('es-CO', { minimumFractionDigits: 0 }) : 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Órdenes Pendientes</CardTitle>
            <Clock className="h-4 w-4" style={{ color: colors.accent }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl" style={{ color: colors.primary }}>{pendingOrders.length}</div>
            <div className="text-xs" style={{ color: colors.accent }}>
              Listas para cobrar
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Efectivo en Caja</CardTitle>
            <Banknote className="h-4 w-4" style={{ color: colors.secondary }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl" style={{ color: colors.primary }}>
              ${recentTransactions
                .filter(t => t.paymentMethod === "efectivo")
                .reduce((sum, t) => sum + t.total, 0)
                .toLocaleString('es-CO', { minimumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-gray-600">
              En efectivo hoy
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="pending">Órdenes Pendientes</TabsTrigger>
          <TabsTrigger value="transactions">Transacciones</TabsTrigger>
          <TabsTrigger value="invoices">Facturas</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Órdenes pendientes */}
            <Card>
              <CardHeader>
                <CardTitle>Órdenes Listas para Cobrar</CardTitle>
                <CardDescription>
                  Selecciona una orden para procesar el pago
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="text-center py-8 text-gray-500">
                    Cargando órdenes...
                  </div>
                ) : pendingOrders.length > 0 ? (
                  pendingOrders.map((order) => {
                    const waiter = usersData?.users?.find(u => u.id === order.createdBy);
                    return (
                      <Card 
                        key={order.id} 
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedOrder?.id === order.id ? "ring-2" : ""
                        }`}
                        style={selectedOrder?.id === order.id ? { borderColor: colors.accent } : {}}
                        onClick={() => setSelectedOrder(order)}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3>Mesa #{order.tableNumber || "N/A"}</h3>
                              <p className="text-sm text-gray-600">Mesero: {waiter?.name || "Desconocido"}</p>
                              <p className="text-sm text-gray-600">
                                Hora: {new Date(order.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg" style={{ color: colors.primary }}>
                                ${order.total?.toLocaleString('es-CO') || 0}
                              </p>
                              <Badge style={{ backgroundColor: colors.secondary, color: "white" }}>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Listo
                              </Badge>
                            </div>
                          </div>
                          <div className="text-sm text-gray-600">
                            {order.items?.length || 0} productos • Total con IVA: ${((order.total || 0) * 1.19).toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No hay órdenes listas para cobrar
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Panel de procesamiento de pago */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calculator className="h-5 w-5" />
                  <span>Procesar Pago</span>
                </CardTitle>
                <CardDescription>
                  {selectedOrder ? `Mesa ${selectedOrder.tableNumber}` : "Selecciona una orden"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {selectedOrder ? (
                  <>
                    {/* Detalle de la orden */}
                    <div className="space-y-3">
                      <h4>Detalle del Pedido</h4>
                      <div className="max-h-32 overflow-y-auto space-y-2">
                        {selectedOrder.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{item.quantity}x {item.name}</span>
                            <span>${((item.price || 0) * (item.quantity || 0)).toLocaleString('es-CO')}</span>
                          </div>
                        )) || <p className="text-sm text-gray-500">No hay items</p>}
                      </div>
                    </div>

                    {/* Cálculos */}
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>${calculateTotals(selectedOrder).subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IVA (19%):</span>
                        <span>${calculateTotals(selectedOrder).tax.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Propina:</span>
                        <span>${calculateTotals(selectedOrder).tip.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-lg border-t pt-2" style={{ color: colors.primary }}>
                        <span>Total:</span>
                        <span>${calculateTotals(selectedOrder).total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    {/* Propina */}
                    <div className="space-y-2">
                      <Label htmlFor="tip">Propina (opcional)</Label>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setTipAmount(((selectedOrder.total || 0) * 0.10).toFixed(2))}
                        >
                          10%
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setTipAmount(((selectedOrder.total || 0) * 0.15).toFixed(2))}
                        >
                          15%
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setTipAmount(((selectedOrder.total || 0) * 0.20).toFixed(2))}
                        >
                          20%
                        </Button>
                        <Input
                          id="tip"
                          type="number"
                          placeholder="$0.00"
                          value={tipAmount}
                          onChange={(e) => setTipAmount(e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    {/* Método de pago */}
                    <div className="space-y-2">
                      <Label>Método de Pago</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant={paymentMethod === "efectivo" ? "default" : "outline"}
                          onClick={() => setPaymentMethod("efectivo")}
                          className="flex items-center space-x-2"
                        >
                          <Banknote className="h-4 w-4" />
                          <span>Efectivo</span>
                        </Button>
                        <Button
                          variant={paymentMethod === "tarjeta" ? "default" : "outline"}
                          onClick={() => setPaymentMethod("tarjeta")}
                          className="flex items-center space-x-2"
                        >
                          <CreditCard className="h-4 w-4" />
                          <span>Tarjeta</span>
                        </Button>
                        <Button
                          variant={paymentMethod === "transferencia" ? "default" : "outline"}
                          onClick={() => setPaymentMethod("transferencia")}
                          className="flex items-center space-x-2"
                        >
                          <Smartphone className="h-4 w-4" />
                          <span>Transferencia</span>
                        </Button>
                        <Button
                          variant={paymentMethod === "mixto" ? "default" : "outline"}
                          onClick={() => setPaymentMethod("mixto")}
                          className="flex items-center space-x-2"
                        >
                          <Zap className="h-4 w-4" />
                          <span>Mixto</span>
                        </Button>
                      </div>
                    </div>

                    {/* Monto recibido (solo para efectivo) */}
                    {paymentMethod === "efectivo" && (
                      <div className="space-y-2">
                        <Label htmlFor="received">Monto Recibido</Label>
                        <Input
                          id="received"
                          type="number"
                          placeholder="$0.00"
                          value={receivedAmount}
                          onChange={(e) => setReceivedAmount(e.target.value)}
                        />
                        {receivedAmount && (
                          <div className="flex justify-between text-sm">
                            <span>Cambio:</span>
                            <span className="font-bold text-green-600">
                              ${calculateChange(selectedOrder).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notas */}
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notas (opcional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Notas adicionales..."
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        rows={2}
                      />
                    </div>

                    {/* Botones de acción */}
                    <div className="space-y-2">
                      <Button 
                        className="w-full" 
                        size="lg"
                        onClick={processPayment}
                        disabled={!paymentMethod || (paymentMethod === "efectivo" && !receivedAmount)}
                        style={{ backgroundColor: colors.accent }}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Procesar Pago - ${calculateTotals(selectedOrder).total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                      </Button>
                      
                      {/* Acciones rápidas de factura */}
                      <div className="pt-2 border-t">
                        <p className="text-xs text-gray-600 mb-2">Acciones de Factura:</p>
                        <div className="grid grid-cols-3 gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleViewInvoice(selectedOrder.id)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handlePrintInvoice(selectedOrder.id)}
                            style={{ borderColor: colors.secondary, color: colors.secondary }}
                          >
                            <Printer className="h-3 w-3 mr-1" />
                            Imprimir
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDownloadInvoice(selectedOrder.id)}
                            style={{ borderColor: colors.accent, color: colors.accent }}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            PDF
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      Selecciona una orden para procesar el pago
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Transacciones del Día</CardTitle>
              <CardDescription>
                Historial de pagos procesados hoy
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  Cargando transacciones...
                </div>
              ) : recentTransactions.length > 0 ? (
                <div className="space-y-4">
                  {recentTransactions.map((payment) => {
                    const order = ordersData?.orders?.find(o => o.id === payment.orderId);
                    const cashier = usersData?.users?.find(u => u.id === payment.createdBy);
                    
                    return (
                      <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                            style={{ backgroundColor: colors.secondary }}
                          >
                            <span>#{order?.tableNumber || "?"}</span>
                          </div>
                          <div>
                            <p>Mesa {order?.tableNumber || "N/A"}</p>
                            <p className="text-sm text-gray-600">
                              {new Date(payment.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} • {payment.paymentMethod}
                            </p>
                            {cashier && (
                              <p className="text-xs text-gray-500">
                                Por: {cashier.name}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <p className="text-lg" style={{ color: colors.primary }}>
                            ${payment.total.toLocaleString('es-CO')}
                          </p>
                          <div className="flex space-x-1 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => payment.orderId && handleViewInvoice(payment.orderId)}
                              disabled={!payment.orderId}
                              title="Ver factura"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => payment.orderId && handlePrintInvoice(payment.orderId)}
                              disabled={!payment.orderId}
                              title="Imprimir"
                              style={{ borderColor: colors.secondary, color: colors.secondary }}
                            >
                              <Printer className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => payment.orderId && handleDownloadInvoice(payment.orderId)}
                              disabled={!payment.orderId}
                              title="Descargar"
                              style={{ borderColor: colors.accent, color: colors.accent }}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No hay transacciones hoy
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Facturas Generadas</CardTitle>
              <CardDescription>
                Visualiza y gestiona las facturas - Haz clic para ver detalles
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  Cargando facturas...
                </div>
              ) : paymentsData?.payments && paymentsData.payments.filter(p => p.orderId).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No. Factura</TableHead>
                      <TableHead>Mesa</TableHead>
                      <TableHead>Fecha y Hora</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentsData.payments
                      .filter(p => p.orderId)
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, 20)
                      .map((payment) => {
                        const order = ordersData?.orders?.find(o => o.id === payment.orderId);
                        return (
                          <TableRow key={payment.id}>
                            <TableCell>
                              {payment.id.replace('payment:', 'INV-').substring(0, 15)}
                            </TableCell>
                            <TableCell>
                              Mesa {order?.tableNumber || "N/A"}
                            </TableCell>
                            <TableCell>
                              {new Date(payment.createdAt).toLocaleString('es-CO', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </TableCell>
                            <TableCell>
                              ${payment.total.toLocaleString('es-CO')}
                            </TableCell>
                            <TableCell>
                              <Badge style={{ backgroundColor: colors.accent, color: 'white' }}>
                                {payment.paymentMethod}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewInvoice(payment.orderId!)}
                                  title="Ver factura"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePrintInvoice(payment.orderId!)}
                                  title="Imprimir factura"
                                  style={{ borderColor: colors.secondary, color: colors.secondary }}
                                >
                                  <Printer className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadInvoice(payment.orderId!)}
                                  title="Descargar factura"
                                  style={{ borderColor: colors.accent, color: colors.accent }}
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEmailInvoice(payment.orderId!)}
                                  title="Enviar por correo"
                                  style={{ borderColor: colors.primary, color: colors.primary }}
                                >
                                  <Mail className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No hay facturas disponibles
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invoice Viewer Modal */}
      <InvoiceViewer
        orderId={selectedInvoiceId}
        open={showInvoiceViewer}
        onClose={() => {
          setShowInvoiceViewer(false);
          setSelectedInvoiceId(null);
        }}
      />

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: colors.primary }}>Enviar Factura por Correo</DialogTitle>
            <DialogDescription>
              Ingresa el correo electrónico del cliente para enviar la factura
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="cliente@ejemplo.com"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Asunto</Label>
              <Input
                id="subject"
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Mensaje</Label>
              <Textarea
                id="message"
                rows={3}
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEmailDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={sendingEmail || !emailAddress}
              style={{ backgroundColor: colors.accent }}
            >
              {sendingEmail ? (
                <>Enviando...</>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}