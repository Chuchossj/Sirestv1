import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import { Separator } from "../ui/separator";
import { toast } from "sonner@2.0.3";
import { 
  CreditCard, 
  DollarSign, 
  Receipt, 
  Calculator,
  Clock,
  CheckCircle,
  Printer,
  Smartphone,
  Banknote,
  FileText,
  TrendingUp,
  QrCode,
  Download,
  Eye,
  Search,
  Send,
  X,
  Mail,
  Share2
} from "lucide-react";
import { useRealtimeData, apiRequest } from "../../utils/useRealtimeData";
import { generateInvoice } from "../../utils/pdfGenerator";

interface CashierModuleProps {
  activeTab?: string;
  accessToken: string;
}

export function CashierModule({ activeTab, accessToken }: CashierModuleProps) {
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [receivedAmount, setReceivedAmount] = useState<string>("");
  const [tipAmount, setTipAmount] = useState<string>("");
  const [customerNotes, setCustomerNotes] = useState<string>("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [cashCount, setCashCount] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Obtener datos en tiempo real
  const { data: ordersData, refetch: refetchOrders } = useRealtimeData({
    endpoint: "/orders",
    accessToken,
    refreshInterval: 2000
  });

  const { data: paymentsData, refetch: refetchPayments } = useRealtimeData({
    endpoint: "/payments",
    accessToken,
    refreshInterval: 3000
  });

  const { data: usersData } = useRealtimeData({
    endpoint: "/users",
    accessToken,
    refreshInterval: 5000
  });

  const orders = ordersData?.orders || [];
  const payments = paymentsData?.payments || [];
  const users = usersData?.users || [];

  // Filtrar pedidos listos para cobrar
  const pendingOrders = orders.filter((o: any) => o.status === "ready" || o.status === "served");

  // Pagos del día
  const todayPayments = payments.filter((p: any) => {
    const paymentDate = new Date(p.createdAt).toDateString();
    return paymentDate === new Date().toDateString();
  });

  const todaysSales = todayPayments.reduce((sum: number, p: any) => sum + (p.total || 0), 0);
  const todaysTransactions = todayPayments.length;

  const calculateTotals = (order: any) => {
    const subtotal = parseFloat(order.subtotal?.toString() || '0');
    const service = Math.round(subtotal * 0.10); // 10% servicio
    const tax = Math.round(subtotal * 0.19); // 19% IVA Colombia
    const tip = parseFloat(tipAmount) || 0;
    const total = subtotal + service + tax + tip;
    
    return { subtotal, service, tax, tip, total };
  };

  const calculateChange = (order: any) => {
    const { total } = calculateTotals(order);
    const received = parseFloat(receivedAmount) || 0;
    return Math.max(0, received - total);
  };

  const processPayment = async () => {
    if (!selectedOrder || !paymentMethod) {
      toast.error("Complete todos los campos requeridos");
      return;
    }
    
    if (paymentMethod === "efectivo" && !receivedAmount) {
      toast.error("Ingrese el monto recibido");
      return;
    }

    try {
      const totals = calculateTotals(selectedOrder);
      
      // Buscar el mesero que creó la orden
      const waiter = users.find((u: any) => u.id === selectedOrder.createdBy);
      
      const paymentData = {
        orderId: selectedOrder.id,
        tableNumber: selectedOrder.tableNumber,
        paymentMethod,
        subtotal: totals.subtotal,
        tax: totals.tax,
        service: totals.service,
        tip: totals.tip,
        total: totals.total,
        receivedAmount: paymentMethod === "efectivo" ? parseFloat(receivedAmount) : totals.total,
        change: paymentMethod === "efectivo" ? calculateChange(selectedOrder) : 0,
        notes: customerNotes,
        waiterName: waiter?.name || 'Mesero desconocido',
        customerName: selectedOrder.customerName || '',
        customerPhone: selectedOrder.customerPhone || ''
      };

      const response = await apiRequest("/payments", {
        method: "POST",
        body: paymentData,
        accessToken
      });

      if (response.success) {
        toast.success("Pago procesado exitosamente");
        setShowReceipt(true);
        resetForm();
        refetchOrders();
        refetchPayments();
      }
    } catch (error) {
      console.error("Error procesando pago:", error);
      toast.error("Error al procesar el pago");
    }
  };

  const resetForm = () => {
    setPaymentMethod("");
    setReceivedAmount("");
    setTipAmount("");
    setCustomerNotes("");
  };

  const generateClosingReport = async () => {
    if (!cashCount) {
      toast.error("Ingrese el conteo de efectivo");
      return;
    }

    try {
      const closingData = {
        cashCount: parseFloat(cashCount),
        notes: closingNotes,
        expectedCash: todayPayments.filter((p: any) => p.paymentMethod === "efectivo").reduce((sum: number, p: any) => sum + p.total, 0)
      };

      const response = await apiRequest("/cash-closing", {
        method: "POST",
        body: closingData,
        accessToken
      });

      if (response.success) {
        toast.success("Cierre de caja generado exitosamente");
        setCashCount("");
        setClosingNotes("");
        refetchPayments();
      }
    } catch (error) {
      console.error("Error generando cierre:", error);
      toast.error("Error al generar cierre de caja");
    }
  };

  // Mapear activeTab a las pestañas internas
  const getDefaultTab = () => {
    switch (activeTab) {
      case "pending-payments":
        return "pending";
      case "transactions":
        return "transactions";
      case "cash-management":
        return "cash-management";
      default:
        return "pending";
    }
  };
  
  const [activeInternalTab, setActiveInternalTab] = useState(getDefaultTab());

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-900 to-purple-900 bg-clip-text text-transparent">
            Panel de Caja
          </h1>
          <p className="text-gray-600 mt-2 text-lg">
            Procesamiento de pagos y facturación
          </p>
        </div>
        <div className="flex items-center space-x-3 mt-4 lg:mt-0">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-3 py-1">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            Caja Operativa
          </Badge>
          <Badge className="bg-orange-100 text-orange-800 border-orange-300">
            Turno: 09:00 - 17:00
          </Badge>
        </div>
      </div>

      {/* Estadísticas del día */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Ventas del Día</CardTitle>
            <DollarSign className="h-5 w-5 opacity-90" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${todaysSales.toLocaleString()}</div>
            <div className="flex items-center space-x-1 text-xs opacity-90 mt-1">
              <TrendingUp className="h-3 w-3" />
              <span>Operativo</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Transacciones</CardTitle>
            <Receipt className="h-5 w-5 opacity-90" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todaysTransactions}</div>
            <div className="text-xs opacity-90 mt-1">
              Promedio: <span className="font-medium">${todaysTransactions > 0 ? (todaysSales / todaysTransactions).toLocaleString() : 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Órdenes Pendientes</CardTitle>
            <Clock className="h-5 w-5 opacity-90" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingOrders.length}</div>
            <div className="text-xs opacity-90 mt-1">
              <span>Listas para cobrar</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Efectivo Total</CardTitle>
            <Banknote className="h-5 w-5 opacity-90" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${todayPayments.filter((p: any) => p.paymentMethod === "efectivo").reduce((sum: number, p: any) => sum + p.total, 0).toLocaleString()}</div>
            <div className="text-xs opacity-90 mt-1">
              En caja
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeInternalTab} onValueChange={setActiveInternalTab} className="space-y-8">
        <TabsList className="grid w-full max-w-2xl grid-cols-4 bg-white border shadow-sm">
          <TabsTrigger value="pending" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-900">
            Órdenes Pendientes
          </TabsTrigger>
          <TabsTrigger value="invoices" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-900">
            <FileText className="h-4 w-4 mr-2" />
            Facturas
          </TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-900">
            Transacciones
          </TabsTrigger>
          <TabsTrigger value="cash-management" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900">
            Caja y Arqueo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Órdenes pendientes */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="text-xl text-blue-900">Órdenes Listas para Cobrar</CardTitle>
                <CardDescription>
                  Selecciona una orden para procesar el pago
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4 max-h-[600px] overflow-y-auto">
                {pendingOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No hay órdenes pendientes de pago</p>
                  </div>
                ) : (
                  pendingOrders.map((order: any) => (
                    <Card 
                      key={order.id} 
                      className={`cursor-pointer transition-all hover:shadow-lg border-2 ${
                        selectedOrder?.id === order.id ? "border-blue-500 bg-blue-50" : "border-gray-200"
                      }`}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-blue-900">Mesa #{order.tableNumber}</h3>
                            <p className="text-sm text-gray-600">{order.items?.length || 0} productos</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-xl text-orange-600">${order.subtotal?.toLocaleString() || 0}</p>
                            <Badge className="bg-green-100 text-green-800 border-green-300">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Listo
                            </Badge>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">
                          Total con cargos: ${(order.subtotal * 1.29).toFixed(0).toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Panel de procesamiento de pago */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center space-x-2 text-xl text-blue-900">
                  <Calculator className="h-5 w-5" />
                  <span>Procesar Pago</span>
                </CardTitle>
                <CardDescription>
                  {selectedOrder ? `Mesa ${selectedOrder.tableNumber}` : "Selecciona una orden"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {selectedOrder ? (
                  <>
                    {/* Detalle de la orden */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-blue-900">Detalle del Pedido</h4>
                      <div className="max-h-32 overflow-y-auto space-y-2 bg-gray-50 p-3 rounded-lg">
                        {selectedOrder.items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{item.quantity}x {item.name}</span>
                            <span className="font-medium">${(item.price * item.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cálculos detallados */}
                    <div className="border-t pt-4 space-y-3 bg-blue-50 p-4 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>${calculateTotals(selectedOrder).subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Servicio (10%):</span>
                        <span>${calculateTotals(selectedOrder).service.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>IVA (19%):</span>
                        <span>${calculateTotals(selectedOrder).tax.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Propina:</span>
                        <span>${calculateTotals(selectedOrder).tip.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2 text-blue-900">
                        <span>Total a Pagar:</span>
                        <span>${calculateTotals(selectedOrder).total.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Propina */}
                    <div className="space-y-3">
                      <Label htmlFor="tip" className="text-blue-900 font-medium">Propina (opcional)</Label>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setTipAmount((selectedOrder.subtotal * 0.10).toFixed(0))}
                          className="border-orange-300 text-orange-700 hover:bg-orange-50"
                        >
                          10%
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setTipAmount((selectedOrder.subtotal * 0.15).toFixed(0))}
                          className="border-orange-300 text-orange-700 hover:bg-orange-50"
                        >
                          15%
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setTipAmount((selectedOrder.subtotal * 0.20).toFixed(0))}
                          className="border-orange-300 text-orange-700 hover:bg-orange-50"
                        >
                          20%
                        </Button>
                        <Input
                          id="tip"
                          type="number"
                          placeholder="$0"
                          value={tipAmount}
                          onChange={(e) => setTipAmount(e.target.value)}
                          className="flex-1 border-gray-300 focus:border-orange-500"
                        />
                      </div>
                    </div>

                    {/* Método de pago */}
                    <div className="space-y-3">
                      <Label className="text-blue-900 font-medium">Método de Pago</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant={paymentMethod === "efectivo" ? "default" : "outline"}
                          onClick={() => setPaymentMethod("efectivo")}
                          className={`flex items-center space-x-2 ${paymentMethod === "efectivo" ? "bg-green-600 hover:bg-green-700" : "border-gray-300"}`}
                        >
                          <Banknote className="h-4 w-4" />
                          <span>Efectivo</span>
                        </Button>
                        <Button
                          variant={paymentMethod === "tarjeta" ? "default" : "outline"}
                          onClick={() => setPaymentMethod("tarjeta")}
                          className={`flex items-center space-x-2 ${paymentMethod === "tarjeta" ? "bg-blue-600 hover:bg-blue-700" : "border-gray-300"}`}
                        >
                          <CreditCard className="h-4 w-4" />
                          <span>Tarjeta</span>
                        </Button>
                        <Button
                          variant={paymentMethod === "transferencia" ? "default" : "outline"}
                          onClick={() => setPaymentMethod("transferencia")}
                          className={`flex items-center space-x-2 ${paymentMethod === "transferencia" ? "bg-purple-600 hover:bg-purple-700" : "border-gray-300"}`}
                        >
                          <Smartphone className="h-4 w-4" />
                          <span>Transferencia</span>
                        </Button>
                        <Button
                          variant={paymentMethod === "qr" ? "default" : "outline"}
                          onClick={() => setPaymentMethod("qr")}
                          className={`flex items-center space-x-2 ${paymentMethod === "qr" ? "bg-orange-600 hover:bg-orange-700" : "border-gray-300"}`}
                        >
                          <QrCode className="h-4 w-4" />
                          <span>QR</span>
                        </Button>
                      </div>
                    </div>

                    {/* Monto recibido (solo para efectivo) */}
                    {paymentMethod === "efectivo" && (
                      <div className="space-y-2">
                        <Label htmlFor="received" className="text-blue-900 font-medium">Monto Recibido</Label>
                        <Input
                          id="received"
                          type="number"
                          placeholder="$0"
                          value={receivedAmount}
                          onChange={(e) => setReceivedAmount(e.target.value)}
                          className="border-gray-300 focus:border-green-500"
                        />
                        {receivedAmount && (
                          <div className="flex justify-between text-lg font-medium p-3 bg-green-50 rounded-lg">
                            <span className="text-green-800">Cambio:</span>
                            <span className="text-green-700 font-bold">
                              ${calculateChange(selectedOrder).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notas */}
                    <div className="space-y-2">
                      <Label htmlFor="notes" className="text-blue-900 font-medium">Notas (opcional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Observaciones adicionales..."
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        rows={2}
                        className="border-gray-300 focus:border-blue-500"
                      />
                    </div>

                    {/* Botones de acción */}
                    <div className="space-y-3">
                      <Button 
                        className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white" 
                        size="lg"
                        onClick={processPayment}
                        disabled={!paymentMethod || (paymentMethod === "efectivo" && !receivedAmount)}
                      >
                        <CreditCard className="h-5 w-5 mr-2" />
                        Procesar Pago - ${calculateTotals(selectedOrder).total.toLocaleString()}
                      </Button>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                          <Printer className="h-4 w-4 mr-2" />
                          Factura
                        </Button>
                        <Button variant="outline" size="sm" className="border-purple-300 text-purple-700 hover:bg-purple-50">
                          <FileText className="h-4 w-4 mr-2" />
                          Recibo
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <Receipt className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">
                      Selecciona una orden para procesar el pago
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-8">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                <div>
                  <CardTitle className="text-xl text-[#5B2C90]">📄 Facturas Pagadas</CardTitle>
                  <CardDescription>
                    Visualiza, imprime y descarga facturas electrónicas
                  </CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por mesa o monto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full md:w-64 border-[#5B2C90] focus:border-[#F28C1B]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {todayPayments.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-20 w-20 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No hay facturas generadas hoy</p>
                  <p className="text-sm text-gray-400 mt-2">Las facturas aparecerán aquí después de procesar pagos</p>
                </div>
              ) : (
<div className="space-y-4">
                  {todayPayments
                    .filter((payment: any) => {
                      if (!searchQuery) return true;
                      const query = searchQuery.toLowerCase();
                      return (
                        payment.tableNumber?.toString().includes(query) ||
                        payment.total?.toString().includes(query)
                      );
                    })
                    .map((payment: any) => {
                      const relatedOrder = orders.find((o: any) => o.id === payment.orderId);
                      return (
                        <Card
                          key={payment.id}
                          className="border-2 border-gray-200 hover:border-[#5B2C90] transition-all hover:shadow-lg"
                        >
                          <CardContent className="p-6">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                              <div className="flex items-start space-x-4 flex-1">
                                <div className="w-14 h-14 bg-gradient-to-br from-[#5B2C90] to-[#0B2240] rounded-xl flex items-center justify-center flex-shrink-0">
                                  <FileText className="h-7 w-7 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2 flex-wrap">
                                    <h3 className="font-semibold text-[#0B2240]">
                                      Factura #{payment.id.slice(0, 8).toUpperCase()}
                                    </h3>
                                    <Badge className="bg-green-100 text-green-800 border-green-300">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Pagada
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-600 mt-1">
                                    Mesa {payment.tableNumber} • {new Date(payment.createdAt).toLocaleDateString('es-ES')} {new Date(payment.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Método: <span className="capitalize font-medium">{payment.paymentMethod}</span> • {relatedOrder?.items?.length || 0} productos
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-4">
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">Total</p>
                                  <p className="text-2xl font-bold text-[#0B2240]">
                                    ${payment.total?.toLocaleString() || 0}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    IVA incluido
                                  </p>
                                </div>
                                
                                <div className="flex lg:flex-col flex-row space-y-0 lg:space-y-2 space-x-2 lg:space-x-0">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-[#5B2C90] text-[#5B2C90] hover:bg-[#5B2C90] hover:text-white"
                                    onClick={() => {
                                      setSelectedInvoice(payment);
                                      setShowInvoiceDialog(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Ver
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-[#F28C1B] text-[#F28C1B] hover:bg-[#F28C1B] hover:text-white"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const relatedOrder = orders.find((o: any) => o.id === payment.orderId);
                                      const waiter = users.find((u: any) => u.id === relatedOrder?.createdBy);
                                      const doc = generateInvoice({
                                        invoiceNumber: `INV-${payment.id.slice(0, 8).toUpperCase()}`,
                                        date: new Date(payment.createdAt).toLocaleDateString('es-CO'),
                                        customerName: payment.customerName,
                                        customerPhone: payment.customerPhone,
                                        tableNumber: payment.tableNumber,
                                        waiterName: waiter?.name || payment.waiterName,
                                        items: relatedOrder?.items?.map((item: any) => ({
                                          name: item.name,
                                          quantity: item.quantity,
                                          price: item.price,
                                          total: item.price * item.quantity
                                        })) || [],
                                        subtotal: payment.subtotal || 0,
                                        service: payment.service || 0,
                                        tax: payment.tax || 0,
                                        taxRate: 19,
                                        tip: payment.tip || 0,
                                        total: payment.total || 0,
                                        paymentMethod: payment.paymentMethod
                                      });
                                      doc.save(`factura-INV-${payment.id.slice(0, 8).toUpperCase()}.pdf`);
                                      toast.success('✅ Factura descargada como PDF');
                                    }}
                                  >
                                    <Download className="h-4 w-4 mr-1" />
                                    PDF
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-[#0B2240] text-[#0B2240] hover:bg-[#0B2240] hover:text-white"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const relatedOrder = orders.find((o: any) => o.id === payment.orderId);
                                      const waiter = users.find((u: any) => u.id === relatedOrder?.createdBy);
                                      const doc = generateInvoice({
                                        invoiceNumber: `INV-${payment.id.slice(0, 8).toUpperCase()}`,
                                        date: new Date(payment.createdAt).toLocaleDateString('es-CO'),
                                        customerName: payment.customerName,
                                        customerPhone: payment.customerPhone,
                                        tableNumber: payment.tableNumber,
                                        waiterName: waiter?.name || payment.waiterName,
                                        items: relatedOrder?.items?.map((item: any) => ({
                                          name: item.name,
                                          quantity: item.quantity,
                                          price: item.price,
                                          total: item.price * item.quantity
                                        })) || [],
                                        subtotal: payment.subtotal || 0,
                                        service: payment.service || 0,
                                        tax: payment.tax || 0,
                                        taxRate: 19,
                                        tip: payment.tip || 0,
                                        total: payment.total || 0,
                                        paymentMethod: payment.paymentMethod
                                      });
                                      
                                      // Generar PDF y abrir en nueva ventana para imprimir
                                      const pdfBlob = doc.output('blob');
                                      const url = URL.createObjectURL(pdfBlob);
                                      const printWindow = window.open(url);
                                      if (printWindow) {
                                        printWindow.onload = () => {
                                          printWindow.print();
                                        };
                                      }
                                      toast.success('📄 Preparando impresión...');
                                    }}
                                  >
                                    <Printer className="h-4 w-4 mr-1" />
                                    Imprimir
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-8">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="text-xl text-blue-900">Transacciones del Día</CardTitle>
              <CardDescription>
                Historial de pagos procesados hoy
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {todayPayments.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No hay transacciones registradas hoy</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {todayPayments.map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-gray-200">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                          <span className="text-white font-bold">#{payment.tableNumber}</span>
                        </div>
                        <div>
                          <p className="font-medium text-blue-900">Mesa {payment.tableNumber}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(payment.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} • {payment.paymentMethod}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xl text-green-600">${payment.total?.toLocaleString() || 0}</p>
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completado
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash-management" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Arqueo de caja */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="text-xl text-blue-900">Arqueo de Caja</CardTitle>
                <CardDescription>
                  Control de efectivo y cuadre de turno
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3">Movimientos del Día</h4>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-sm text-green-700">Ingresos Efectivo</p>
                      <p className="text-xl font-bold text-green-600">
                        ${todayPayments.filter((p: any) => p.paymentMethod === 'efectivo').reduce((sum: number, p: any) => sum + p.total, 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-blue-700">Tarjetas</p>
                      <p className="text-xl font-bold text-blue-600">
                        ${todayPayments.filter((p: any) => p.paymentMethod === 'tarjeta').reduce((sum: number, p: any) => sum + p.total, 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-purple-700">Total Esperado en Caja</p>
                    <p className="text-2xl font-bold text-purple-600">
                      ${todayPayments.filter((p: any) => p.paymentMethod === 'efectivo').reduce((sum: number, p: any) => sum + p.total, 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-blue-900 font-medium">Conteo Real de Efectivo</Label>
                  <Input 
                    type="number" 
                    placeholder="Ingrese el conteo manual"
                    value={cashCount}
                    onChange={(e) => setCashCount(e.target.value)}
                    className="border-gray-300 focus:border-blue-500"
                  />
                  
                  {cashCount && (
                    <div className={`p-3 rounded-lg ${
                      parseFloat(cashCount) === todayPayments.filter((p: any) => p.paymentMethod === 'efectivo').reduce((sum: number, p: any) => sum + p.total, 0) 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    } border`}>
                      <p className="text-sm font-medium">
                        Diferencia: ${Math.abs(parseFloat(cashCount) - todayPayments.filter((p: any) => p.paymentMethod === 'efectivo').reduce((sum: number, p: any) => sum + p.total, 0)).toLocaleString()}
                      </p>
                    </div>
                  )}

                  <Label className="text-blue-900 font-medium">Notas del Cierre</Label>
                  <Textarea
                    placeholder="Observaciones del arqueo..."
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    rows={3}
                    className="border-gray-300 focus:border-blue-500"
                  />

                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={generateClosingReport}
                    disabled={!cashCount}
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Generar Reporte de Cierre
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Resumen de métodos de pago */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="text-xl text-blue-900">Resumen de Métodos de Pago</CardTitle>
                <CardDescription>
                  Distribución de pagos del día
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Banknote className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="font-medium text-green-900">Efectivo</p>
                        <p className="text-sm text-green-600">
                          {todayPayments.filter((p: any) => p.paymentMethod === 'efectivo').length} transacciones
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-600">
                        ${todayPayments.filter((p: any) => p.paymentMethod === 'efectivo').reduce((sum: number, p: any) => sum + p.total, 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <CreditCard className="h-8 w-8 text-blue-600" />
                      <div>
                        <p className="font-medium text-blue-900">Tarjeta</p>
                        <p className="text-sm text-blue-600">
                          {todayPayments.filter((p: any) => p.paymentMethod === 'tarjeta').length} transacciones
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-blue-600">
                        ${todayPayments.filter((p: any) => p.paymentMethod === 'tarjeta').reduce((sum: number, p: any) => sum + p.total, 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Smartphone className="h-8 w-8 text-purple-600" />
                      <div>
                        <p className="font-medium text-purple-900">Transferencia</p>
                        <p className="text-sm text-purple-600">
                          {todayPayments.filter((p: any) => p.paymentMethod === 'transferencia').length} transacciones
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-purple-600">
                        ${todayPayments.filter((p: any) => p.paymentMethod === 'transferencia').reduce((sum: number, p: any) => sum + p.total, 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-blue-900">Total General:</span>
                    <span className="text-2xl font-bold text-green-600">${todaysSales.toLocaleString()}</span>
                  </div>
                  
                  <Button variant="outline" className="w-full border-blue-300 text-blue-700 hover:bg-blue-50">
                    <FileText className="h-4 w-4 mr-2" />
                    Imprimir Resumen del Día
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog de visualización completa de factura */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl text-[#0B2240]">
                  📄 Factura Electrónica
                </DialogTitle>
                <DialogDescription>
                  Detalles completos de la transacción
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowInvoiceDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>
          
          {selectedInvoice && (() => {
            const relatedOrder = orders.find((o: any) => o.id === selectedInvoice.orderId);
            const waiter = users.find((u: any) => u.id === relatedOrder?.createdBy);
            
            return (
              <div className="space-y-6 py-4">
                {/* Cabecera de la factura */}
                <div className="bg-gradient-to-r from-[#0B2240] to-[#5B2C90] p-8 rounded-xl text-white shadow-lg">
                  <div className="text-center">
                    <h2 className="text-3xl font-bold">SIREST</h2>
                    <p className="text-sm mt-2 opacity-90">Sistema de Gestión de Restaurante</p>
                    <Separator className="my-3 opacity-30" />
                    <p className="text-sm font-medium">Globatech S.A.S.</p>
                    <p className="text-xs mt-1 opacity-75">NIT: 900.123.456-7</p>
                    <p className="text-xs opacity-75">Calle Principal #123, Bogotá - Colombia</p>
                    <p className="text-xs opacity-75">Tel: +57 300 123 4567</p>
                  </div>
                </div>

                {/* Información de la factura */}
                <Card className="border-[#5B2C90] border-2">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">No. Factura</p>
                          <p className="font-bold text-lg text-[#0B2240]">
                            INV-{selectedInvoice.id.slice(0, 8).toUpperCase()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Mesa</p>
                          <p className="font-semibold text-[#F28C1B]">Mesa #{selectedInvoice.tableNumber}</p>
                        </div>
                        {waiter && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Atendido por</p>
                            <p className="font-semibold">{waiter.name}</p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3 text-right">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Fecha</p>
                          <p className="font-semibold">
                            {new Date(selectedInvoice.createdAt).toLocaleDateString('es-CO', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Hora</p>
                          <p className="font-semibold">
                            {new Date(selectedInvoice.createdAt).toLocaleTimeString('es-CO', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Información del cliente si existe */}
                    {(selectedInvoice.customerName || selectedInvoice.customerPhone) && (
                      <>
                        <Separator className="my-4" />
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Información del Cliente</p>
                          {selectedInvoice.customerName && (
                            <p className="font-semibold">
                              <span className="text-gray-600">Nombre:</span> {selectedInvoice.customerName}
                            </p>
                          )}
                          {selectedInvoice.customerPhone && (
                            <p className="font-semibold">
                              <span className="text-gray-600">Teléfono:</span> {selectedInvoice.customerPhone}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Productos */}
                <Card>
                  <CardHeader className="bg-[#F28C1B] bg-opacity-10 border-b">
                    <CardTitle className="text-[#F28C1B]">Detalle de Productos</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left p-4 font-semibold text-sm text-gray-700">Producto</th>
                            <th className="text-center p-4 font-semibold text-sm text-gray-700">Cantidad</th>
                            <th className="text-right p-4 font-semibold text-sm text-gray-700">Precio Unit.</th>
                            <th className="text-right p-4 font-semibold text-sm text-gray-700">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatedOrder?.items?.map((item: any, idx: number) => (
                            <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                              <td className="p-4">
                                <p className="font-medium text-[#0B2240]">{item.name}</p>
                              </td>
                              <td className="p-4 text-center">
                                <Badge variant="outline" className="font-semibold">{item.quantity}</Badge>
                              </td>
                              <td className="p-4 text-right text-gray-600">
                                ${item.price.toLocaleString('es-CO')}
                              </td>
                              <td className="p-4 text-right font-semibold text-[#0B2240]">
                                ${(item.quantity * item.price).toLocaleString('es-CO')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Totales */}
                <Card className="border-[#0B2240] border-2">
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-semibold">${selectedInvoice.subtotal?.toLocaleString('es-CO') || 0}</span>
                      </div>
                      {(selectedInvoice.service && selectedInvoice.service > 0) && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Servicio (10%):</span>
                          <span className="font-semibold">${selectedInvoice.service?.toLocaleString('es-CO') || 0}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">IVA (19%):</span>
                        <span className="font-semibold">${selectedInvoice.tax?.toLocaleString('es-CO') || 0}</span>
                      </div>
                      {(selectedInvoice.tip && selectedInvoice.tip > 0) && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Propina:</span>
                          <span className="font-semibold text-green-600">${selectedInvoice.tip?.toLocaleString('es-CO') || 0}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-xl font-bold text-[#0B2240]">TOTAL:</span>
                        <span className="text-2xl font-bold text-[#F28C1B]">
                          ${selectedInvoice.total?.toLocaleString('es-CO') || 0}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Método de pago y estado */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-[#5B2C90] bg-opacity-10 border-[#5B2C90]">
                    <CardContent className="p-4">
                      <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Método de Pago</p>
                      <p className="text-lg font-bold text-[#5B2C90] capitalize">
                        {selectedInvoice.paymentMethod}
                      </p>
                      {selectedInvoice.notes && (
                        <p className="text-sm text-gray-600 mt-2">
                          <span className="font-semibold">Notas:</span> {selectedInvoice.notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 border-green-300">
                    <CardContent className="p-4 flex items-center justify-center">
                      <Badge className="bg-green-500 text-white px-4 py-2 text-base">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Pagada y Procesada
                      </Badge>
                    </CardContent>
                  </Card>
                </div>

                {/* Botones de acción mejorados */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Button
                    variant="outline"
                    className="border-[#5B2C90] text-[#5B2C90] hover:bg-[#5B2C90] hover:text-white transition-all"
                    onClick={() => {
                      const doc = generateInvoice({
                        invoiceNumber: `INV-${selectedInvoice.id.slice(0, 8).toUpperCase()}`,
                        date: new Date(selectedInvoice.createdAt).toLocaleDateString('es-CO'),
                        customerName: selectedInvoice.customerName,
                        customerPhone: selectedInvoice.customerPhone,
                        tableNumber: selectedInvoice.tableNumber,
                        waiterName: waiter?.name,
                        items: relatedOrder?.items?.map((item: any) => ({
                          name: item.name,
                          quantity: item.quantity,
                          price: item.price,
                          total: item.price * item.quantity
                        })) || [],
                        subtotal: selectedInvoice.subtotal || 0,
                        service: selectedInvoice.service || 0,
                        tax: selectedInvoice.tax || 0,
                        taxRate: 19,
                        tip: selectedInvoice.tip || 0,
                        total: selectedInvoice.total || 0,
                        paymentMethod: selectedInvoice.paymentMethod
                      });
                      
                      // Generar el PDF y abrirlo en nueva ventana para imprimir
                      const pdfBlob = doc.output('blob');
                      const url = URL.createObjectURL(pdfBlob);
                      const printWindow = window.open(url);
                      if (printWindow) {
                        printWindow.onload = () => {
                          printWindow.print();
                        };
                      }
                      toast.success('Preparando impresión...');
                    }}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                  <Button
                    variant="outline"
                    className="border-[#F28C1B] text-[#F28C1B] hover:bg-[#F28C1B] hover:text-white transition-all"
                    onClick={() => {
                      const doc = generateInvoice({
                        invoiceNumber: `INV-${selectedInvoice.id.slice(0, 8).toUpperCase()}`,
                        date: new Date(selectedInvoice.createdAt).toLocaleDateString('es-CO'),
                        customerName: selectedInvoice.customerName,
                        customerPhone: selectedInvoice.customerPhone,
                        tableNumber: selectedInvoice.tableNumber,
                        waiterName: waiter?.name,
                        items: relatedOrder?.items?.map((item: any) => ({
                          name: item.name,
                          quantity: item.quantity,
                          price: item.price,
                          total: item.price * item.quantity
                        })) || [],
                        subtotal: selectedInvoice.subtotal || 0,
                        service: selectedInvoice.service || 0,
                        tax: selectedInvoice.tax || 0,
                        taxRate: 19,
                        tip: selectedInvoice.tip || 0,
                        total: selectedInvoice.total || 0,
                        paymentMethod: selectedInvoice.paymentMethod
                      });
                      doc.save(`factura-INV-${selectedInvoice.id.slice(0, 8).toUpperCase()}.pdf`);
                      toast.success('✅ Factura descargada como PDF');
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Descargar
                  </Button>
                  <Button
                    variant="outline"
                    className="border-[#0B2240] text-[#0B2240] hover:bg-[#0B2240] hover:text-white transition-all"
                    onClick={() => {
                      setEmailAddress(selectedInvoice.customerPhone || "");
                      setShowEmailDialog(true);
                    }}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Enviar
                  </Button>
                  <Button
                    variant="outline"
                    className="border-[#FFD23F] text-[#0B2240] hover:bg-[#FFD23F] transition-all"
                    onClick={async () => {
                      try {
                        const doc = generateInvoice({
                          invoiceNumber: `INV-${selectedInvoice.id.slice(0, 8).toUpperCase()}`,
                          date: new Date(selectedInvoice.createdAt).toLocaleDateString('es-CO'),
                          customerName: selectedInvoice.customerName,
                          customerPhone: selectedInvoice.customerPhone,
                          tableNumber: selectedInvoice.tableNumber,
                          waiterName: waiter?.name,
                          items: relatedOrder?.items?.map((item: any) => ({
                            name: item.name,
                            quantity: item.quantity,
                            price: item.price,
                            total: item.price * item.quantity
                          })) || [],
                          subtotal: selectedInvoice.subtotal || 0,
                          service: selectedInvoice.service || 0,
                          tax: selectedInvoice.tax || 0,
                          taxRate: 19,
                          tip: selectedInvoice.tip || 0,
                          total: selectedInvoice.total || 0,
                          paymentMethod: selectedInvoice.paymentMethod
                        });
                        
                        const pdfBlob = doc.output('blob');
                        const file = new File([pdfBlob], `factura-${selectedInvoice.id.slice(0, 8)}.pdf`, { type: 'application/pdf' });
                        
                        if (navigator.share && navigator.canShare({ files: [file] })) {
                          await navigator.share({
                            files: [file],
                            title: 'Factura SIREST',
                            text: `Factura #INV-${selectedInvoice.id.slice(0, 8).toUpperCase()}`
                          });
                          toast.success('✅ Factura compartida');
                        } else {
                          toast.error('Compartir no disponible en este dispositivo');
                        }
                      } catch (error) {
                        console.error('Error al compartir:', error);
                        toast.error('Error al compartir la factura');
                      }
                    }}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Compartir
                  </Button>
                </div>

                {/* Footer */}
                <div className="bg-gradient-to-r from-[#5B2C90] to-[#0B2240] p-4 rounded-lg text-center text-white">
                  <p className="font-semibold">¡Gracias por su preferencia!</p>
                  <p className="text-xs mt-1 opacity-75">Esta factura fue generada electrónicamente por SIREST</p>
                  <p className="text-xs opacity-75">Sistema de Gestión de Restaurante - Globatech S.A.S.</p>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog de envío por email */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#0B2240] flex items-center">
              <Mail className="h-5 w-5 mr-2 text-[#F28C1B]" />
              Enviar Factura por Email
            </DialogTitle>
            <DialogDescription>
              Ingresa el correo electrónico del cliente
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
                className="border-[#5B2C90] focus:border-[#F28C1B]"
              />
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Nota:</span> La factura se enviará como archivo PDF adjunto al correo electrónico proporcionado.
              </p>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowEmailDialog(false);
                  setEmailAddress("");
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-[#F28C1B] hover:bg-[#F28C1B]/90"
                onClick={() => {
                  if (!emailAddress) {
                    toast.error('Por favor ingresa un correo electrónico');
                    return;
                  }
                  
                  // Aquí iría la lógica para enviar el email
                  // Por ahora simulamos el envío
                  toast.success(`✅ Factura enviada a ${emailAddress}`);
                  setShowEmailDialog(false);
                  setEmailAddress("");
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de recibo */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-blue-900">✅ Pago Procesado</DialogTitle>
            <DialogDescription className="text-center">
              Transacción completada exitosamente
            </DialogDescription>
          </DialogHeader>
          <div className="text-center space-y-4 py-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <p className="text-lg font-semibold">Pago realizado correctamente</p>
            <div className="flex space-x-2">
              <Button variant="outline" className="flex-1">
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
              <Button className="flex-1 bg-blue-600" onClick={() => setShowReceipt(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}