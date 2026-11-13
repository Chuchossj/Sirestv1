import { useState } from "react";
import { SecureLogin } from "./components/sirest/SecureLogin";
import { ClientPortal } from "./components/sirest/ClientPortal";
import { AdminDashboard } from "./components/sirest/AdminDashboard";
import { AdminSupervisionView } from "./components/sirest/AdminSupervisionView";
import { WaiterModule } from "./components/sirest/WaiterModule";
import { CashierModule } from "./components/sirest/CashierModule";
import { KitchenModule } from "./components/sirest/KitchenModule";
import { UserProfile } from "./components/sirest/UserProfile";
import { SystemConfiguration } from "./components/sirest/SystemConfiguration";
import { PasswordReset } from "./components/sirest/PasswordReset";
import { InventoryManagement } from "./components/restaurant/InventoryManagement";
import { UserManagement } from "./components/restaurant/UserManagement";
import { ReportsAndAnalytics } from "./components/restaurant/ReportsAndAnalytics";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarFooter, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem, 
  SidebarProvider, 
  SidebarTrigger,
  useSidebar
} from "./components/ui/sidebar";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Toaster } from "./components/ui/sonner";
import { 
  Home, 
  Package, 
  Users, 
  CreditCard, 
  ChefHat,
  Utensils,
  BarChart3,
  Settings,
  User,
  LogOut,
  Building2,
  Clock,
  Receipt,
  UserCheck,
  Calculator,
  FileText,
  Bell
} from "lucide-react";

interface UserSession {
  role: string;
  username: string;
  userData: any;
  accessToken: string;
}

// Configuración de menús por rol con seguridad estricta
const getMenuItems = (role: string) => {
  const menuConfigs = {
    administrador: [
      {
        title: "Panel Principal",
        items: [
          { title: "Dashboard", icon: Home, id: "dashboard", badge: null }
        ]
      },
      {
        title: "Gestión Administrativa",
        items: [
          { title: "Gestión de Usuarios", icon: Users, id: "users", badge: null },
          { title: "Inventario", icon: Package, id: "inventory", badge: null },
          { title: "Reportes y Análisis", icon: BarChart3, id: "reports", badge: null }
        ]
      },
      {
        title: "Supervisión",
        items: [
          { title: "Centro de Alertas", icon: Bell, id: "alerts-view", badge: null },
          { title: "Estado del Personal", icon: UserCheck, id: "staff-view", badge: null },
          { title: "Control de Cocina", icon: ChefHat, id: "kitchen-view", badge: null },
          { title: "Punto de Venta", icon: CreditCard, id: "pos-view", badge: null },
          { title: "Control de Mesas", icon: Utensils, id: "tables-view", badge: null }
        ]
      }
    ],
    mesero: [
      {
        title: "Panel de Servicio",
        items: [
          { title: "Mi Dashboard", icon: Home, id: "dashboard", badge: null }
        ]
      },
      {
        title: "Gestión de Mesas",
        items: [
          { title: "Mis Mesas", icon: Utensils, id: "tables", badge: null },
          { title: "Nuevo Pedido", icon: FileText, id: "new-order", badge: null },
          { title: "Pedidos Activos", icon: Clock, id: "active-orders", badge: null }
        ]
      }
    ],
    cajero: [
      {
        title: "Panel de Caja",
        items: [
          { title: "Mi Dashboard", icon: Home, id: "dashboard", badge: null }
        ]
      },
      {
        title: "Procesamiento",
        items: [
          { title: "Órdenes a Cobrar", icon: CreditCard, id: "pending-payments", badge: null },
          { title: "Transacciones", icon: Receipt, id: "transactions", badge: null },
          { title: "Caja y Arqueo", icon: Calculator, id: "cash-management", badge: null }
        ]
      }
    ],
    cocinero: [
      {
        title: "Panel de Cocina",
        items: [
          { title: "Mi Dashboard", icon: Home, id: "dashboard", badge: null }
        ]
      },
      {
        title: "Producción",
        items: [
          { title: "Órdenes Pendientes", icon: Clock, id: "pending-orders", badge: null },
          { title: "En Preparación", icon: ChefHat, id: "preparing-orders", badge: null },
          { title: "Órdenes Listas", icon: Receipt, id: "ready-orders", badge: null }
        ]
      }
    ]
  };

  return menuConfigs[role as keyof typeof menuConfigs] || [];
};

const getRoleIcon = (role: string) => {
  const icons = {
    administrador: UserCheck,
    mesero: Users,
    cajero: CreditCard,
    cocinero: ChefHat
  };
  return icons[role as keyof typeof icons] || User;
};

const getRoleColor = (role: string) => {
  const colors = {
    administrador: "bg-gray-900 text-white border-gray-700",
    mesero: "bg-blue-100 text-blue-800 border-blue-300",
    cajero: "bg-green-100 text-green-800 border-green-300",
    cocinero: "bg-yellow-100 text-yellow-800 border-yellow-300"
  };
  return colors[role as keyof typeof colors] || "bg-gray-100 text-gray-800";
};

const getModuleName = (activeModule: string, role: string) => {
  if (activeModule === "profile") return "Mi Perfil";
  if (activeModule === "configuration") return "Configuración";
  
  const allItems = getMenuItems(role).flatMap(g => g.items);
  return allItems.find(item => item.id === activeModule)?.title || "Dashboard";
};

function AppSidebar({ 
  userSession, 
  activeModule, 
  setActiveModule, 
  onLogout 
}: { 
  userSession: UserSession;
  activeModule: string; 
  setActiveModule: (module: string) => void;
  onLogout: () => void;
}) {
  const menuItems = getMenuItems(userSession.role);
  const { isMobile, setOpenMobile } = useSidebar();
  const navigate = (id: string) => { setActiveModule(id); if (isMobile) setOpenMobile(false); };
  const RoleIcon = getRoleIcon(userSession.role);

  return (
    <Sidebar className="sirest-sidebar">
      <SidebarHeader className="sirest-brand-header">
        <div className="flex items-center space-x-3">
          <div className="sirest-brand-mark">
            <Utensils className="h-6 w-6" />
          </div>
          <div>
            <h2 className="sirest-brand-name">SIREST</h2>
            <p className="sirest-brand-subtitle">Gestión de restaurantes</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        {menuItems.map((group, index) => (
          <SidebarGroup key={index}>
            <SidebarGroupLabel className="sirest-nav-label">{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton 
                        isActive={activeModule === item.id}
                        onClick={() => navigate(item.id)}
                        className="sirest-nav-item"
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        {item.badge && (
                          <Badge className="ml-auto bg-red-100 text-red-800 border-red-300">
                            {item.badge}
                          </Badge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      
      <SidebarFooter className="sirest-nav-footer">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={() => navigate("configuration")}
              isActive={activeModule === "configuration"} className="sirest-nav-item"
            >
              <Settings className="h-4 w-4" />
              <span>Configuración</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={() => navigate("profile")}
              isActive={activeModule === "profile"} className="sirest-nav-item"
            >
              <User className="h-4 w-4" />
              <span>Mi Perfil</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onLogout} className="sirest-nav-item sirest-logout">
              <LogOut className="h-4 w-4" />
              <span>Cerrar Sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function MainContent({ 
  userSession, 
  activeModule,
  onUserUpdate,
  onNavigate
}: { 
  userSession: UserSession;
  activeModule: string;
  onUserUpdate: (updatedData: any) => void;
  onNavigate: (module: string) => void;
}) {
  const renderContent = () => {
    // Módulos universales disponibles para todos los roles
    if (activeModule === "profile") {
      return <UserProfile userSession={userSession} accessToken={userSession.accessToken} onUpdate={onUserUpdate} />;
    }
    
    if (activeModule === "configuration") {
      return <SystemConfiguration userRole={userSession.role} accessToken={userSession.accessToken} />;
    }

    // Sistema de seguridad: Solo módulos autorizados por rol
    switch (userSession.role) {
      case "administrador":
        switch (activeModule) {
          case "dashboard":
            return <AdminDashboard onNavigate={onNavigate} accessToken={userSession.accessToken} />;
          case "users":
            return <UserManagement accessToken={userSession.accessToken} />;
          case "inventory":
            return <InventoryManagement accessToken={userSession.accessToken} />;
          case "reports":
            return <ReportsAndAnalytics accessToken={userSession.accessToken} />;
          case "alerts-view":
            return <AdminSupervisionView module="alerts" accessToken={userSession.accessToken} />; // Centro de alertas
          case "staff-view":
            return <AdminSupervisionView module="staff" accessToken={userSession.accessToken} />; // Estado del personal
          case "kitchen-view":
            return <AdminSupervisionView module="kitchen" accessToken={userSession.accessToken} />; // Vista de supervisión de cocina
          case "pos-view":
            return <AdminSupervisionView module="pos" accessToken={userSession.accessToken} />; // Vista de supervisión de punto de venta
          case "tables-view":
            return <AdminSupervisionView module="tables" accessToken={userSession.accessToken} />; // Vista de supervisión de mesas
          default:
            return <AdminDashboard onNavigate={onNavigate} accessToken={userSession.accessToken} />;
        }
      
      case "mesero":
        switch (activeModule) {
          case "dashboard":
          case "tables":
          case "new-order":
          case "active-orders":
            return <WaiterModule activeTab={activeModule} accessToken={userSession.accessToken} />;
          default:
            return <WaiterModule accessToken={userSession.accessToken} />;
        }
      
      case "cajero":
        switch (activeModule) {
          case "dashboard":
          case "pending-payments":
          case "transactions":
          case "cash-management":
            return <CashierModule activeTab={activeModule} accessToken={userSession.accessToken} />;
          default:
            return <CashierModule accessToken={userSession.accessToken} />;
        }
      
      case "cocinero":
        switch (activeModule) {
          case "dashboard":
          case "pending-orders":
          case "preparing-orders":
          case "ready-orders":
            return <KitchenModule activeTab={activeModule} accessToken={userSession.accessToken} />;
          default:
            return <KitchenModule accessToken={userSession.accessToken} />;
        }
      
      default:
        return <div className="p-8 text-center text-red-600">Acceso no autorizado</div>;
    }
  };

  return (
    <main className="sirest-main">
      <div className="sirest-content" data-role={userSession.role}>
        {renderContent()}
      </div>
    </main>
  );
}

export default function App() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [activeModule, setActiveModule] = useState("dashboard");
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const handleLogin = (role: string, username: string, userData: any, accessToken: string) => {
    setUserSession({ role, username, userData, accessToken });
    setActiveModule("dashboard");
  };

  const handleLogout = () => {
    setUserSession(null);
    setActiveModule("dashboard");
  };

  const handleUserUpdate = (updatedData: any) => {
    if (userSession) {
      setUserSession({
        ...userSession,
        userData: updatedData
      });
    }
  };

  // Si no hay sesión, mostrar login o reset de contraseña
  if (!userSession) {
    if (showPasswordReset) {
      return <PasswordReset onClose={() => setShowPasswordReset(false)} />;
    }
    return <SecureLogin onLogin={handleLogin} onPasswordReset={() => setShowPasswordReset(true)} />;
  }

  // Interfaz completamente aislada para clientes
  if (userSession.role === "cliente") {
    return <div className="sirest-client"><ClientPortal userData={userSession.userData} onLogout={handleLogout} accessToken={userSession.accessToken} /><Toaster /></div>;
  }

  const RoleIcon = getRoleIcon(userSession.role);

  return (
    <SidebarProvider>
      <div className="sirest-shell">
        <AppSidebar 
          userSession={userSession}
          activeModule={activeModule} 
          setActiveModule={setActiveModule}
          onLogout={handleLogout}
        />
        <div className="sirest-workspace">
          <header className="sirest-topbar">
            <div className="sirest-topbar-left">
              <SidebarTrigger aria-label="Abrir o cerrar menú" />
              <div className="sirest-breadcrumb">
                <span>Espacio de trabajo</span>
                <strong>{getModuleName(activeModule, userSession.role)}</strong>
              </div>
            </div>
            <div className="sirest-account">
              <div className="sirest-account-copy">
                <strong>{userSession.username}</strong>
                <span className="capitalize">{userSession.role}</span>
              </div>
              <div className="sirest-avatar"><RoleIcon className="h-5 w-5" /></div>
            </div>
          </header>
          <MainContent userSession={userSession} activeModule={activeModule} onUserUpdate={handleUserUpdate} onNavigate={setActiveModule} />
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  );
}