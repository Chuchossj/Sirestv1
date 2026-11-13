import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { 
  Eye, 
  EyeOff,
  Building2,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Utensils,
  UserPlus,
  LogIn
} from "lucide-react";
import { apiRequest } from "../../utils/useRealtimeData";

interface SecureLoginProps {
  onLogin: (role: string, username: string, userData: any, accessToken: string) => void;
  onPasswordReset?: () => void;
}

export function SecureLogin({ onLogin, onPasswordReset }: SecureLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("login");
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError("Por favor complete todos los campos");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await apiRequest<{ success: boolean; accessToken: string; user: any }>("/auth/login", {
        method: "POST",
        body: { email, password }
      });

      if (result.success && result.user) {
        setSuccess("✓ Inicio de sesión exitoso");
        
        setTimeout(() => {
          onLogin(
            result.user.role,
            result.user.name || result.user.email,
            result.user,
            result.accessToken
          );
        }, 800);
      }
    } catch (err) {
      console.error("Error en login:", err);
      let errorMessage = "Error al iniciar sesión";
      
      if (err instanceof Error) {
        if (err.message.includes("Invalid login credentials") || err.message.includes("Credenciales inválidas")) {
          errorMessage = "Credenciales inválidas. Verifique su correo y contraseña.";
        } else if (err.message.includes("Cuenta desactivada")) {
          errorMessage = err.message;
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !name) {
      setError("Por favor complete todos los campos");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await apiRequest<{ success: boolean; user: any }>("/auth/signup", {
        method: "POST",
        body: { 
          email, 
          password, 
          name,
          role: "cliente" // Los nuevos registros son clientes por defecto
        }
      });

      if (result.success) {
        setSuccess("✓ Registro exitoso. Ahora puede iniciar sesión.");
        setEmail("");
        setPassword("");
        setName("");
        
        // Cambiar a la pestaña de login después de 2 segundos
        setTimeout(() => {
          setActiveTab("login");
          setSuccess("");
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="sirest-auth">
      <aside className="sirest-auth-hero" aria-label="Presentación de SIREST">
        <div className="sirest-auth-brand"><span className="sirest-brand-mark"><Utensils className="h-6 w-6" /></span><span>SIREST <small>V2</small></span></div>
        <div className="sirest-auth-story"><span className="sirest-eyebrow">OPERACIÓN RESTAURANTERA</span><h2>Tu restaurante,<br />en un solo lugar.</h2><p>Coordina pedidos, cocina, inventario y caja desde un espacio de trabajo conectado.</p><div className="sirest-auth-features"><span><CheckCircle2 /> Gestión de mesas y pedidos</span><span><CheckCircle2 /> Inventario y ventas</span><span><CheckCircle2 /> Acceso por roles</span></div></div>
        <div className="sirest-auth-hero-foot">SIREST · Sistema integral de gestión</div>
      </aside>
      <div className="sirest-auth-form">
        <div className="sirest-auth-panel">
        {/* Logo y Título */}
        <div className="sirest-auth-heading">
          <div className="sirest-auth-mobile-mark">
            <Utensils className="h-6 w-6" />
          </div>
          <h1 className="sirest-auth-title">Bienvenido a SIREST</h1>
          <p>Accede a tu espacio de trabajo.</p>
        </div>

        <Card className="sirest-login-card">
          <CardHeader className="sirest-login-card-header">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Shield className="h-5 w-5 text-[#0B2240]" />
              <CardTitle className="text-2xl text-center text-[#0B2240]">Sistema de Gestión</CardTitle>
            </div>
            <CardDescription className="text-center">
              Ingrese sus credenciales o cree una cuenta nueva
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value); setError(""); setSuccess(""); setShowPassword(false); }} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Iniciar Sesión
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Registrarse
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">


                <form onSubmit={handleLogin} className="space-y-4">
                  {error && (
                    <Alert variant="destructive" className="bg-red-50 border-red-200">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {success && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">{success}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-[#0B2240]">Correo Electrónico</Label>
                    <Input
                      id="login-email" autoComplete="email" required
                      type="email"
                      placeholder="usuario@ejemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      className="border-gray-300 focus:border-[#5B2C90] focus:ring-[#5B2C90]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-[#0B2240]">Contraseña</Label>
                    <div className="relative">
                      <Input
                        id="login-password" autoComplete="current-password" required
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        className="border-gray-300 focus:border-[#5B2C90] focus:ring-[#5B2C90] pr-10"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#5B2C90]"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {onPasswordReset && (
                    <button
                      type="button"
                      onClick={onPasswordReset}
                      className="text-sm text-[#5B2C90] hover:text-[#F28C1B] hover:underline"
                    >
                      ¿Olvidó su contraseña?
                    </button>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#0B2240] to-[#5B2C90] hover:from-[#5B2C90] hover:to-[#F28C1B] text-white shadow-lg"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Iniciar Sesión
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  {error && (
                    <Alert variant="destructive" className="bg-red-50 border-red-200">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {success && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">{success}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-[#0B2240]">Nombre Completo</Label>
                    <Input
                      id="signup-name" autoComplete="name" required
                      type="text"
                      placeholder="Juan Pérez"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isLoading}
                      className="border-gray-300 focus:border-[#5B2C90] focus:ring-[#5B2C90]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-[#0B2240]">Correo Electrónico</Label>
                    <Input
                      id="signup-email" autoComplete="email" required
                      type="email"
                      placeholder="usuario@ejemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      className="border-gray-300 focus:border-[#5B2C90] focus:ring-[#5B2C90]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-[#0B2240]">Contraseña</Label>
                    <div className="relative">
                      <Input
                        id="signup-password" autoComplete="new-password" required
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        className="border-gray-300 focus:border-[#5B2C90] focus:ring-[#5B2C90] pr-10"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#5B2C90]"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      La contraseña debe tener al menos 6 caracteres
                    </p>
                  </div>

                  <div className="bg-gradient-to-r from-[#FFD23F]/10 to-[#F28C1B]/10 border border-[#F28C1B]/30 rounded-lg p-3">
                    <p className="text-xs text-[#0B2240]">
                      <Shield className="h-3 w-3 inline mr-1 text-[#F28C1B]" />
                      Al registrarse, se creará una cuenta de tipo <strong>Cliente</strong>. 
                      Para cuentas de staff, contacte al administrador.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#5B2C90] to-[#F28C1B] hover:from-[#F28C1B] hover:to-[#FFD23F] text-white shadow-lg"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creando cuenta...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Crear Cuenta
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
              <div className="flex items-center justify-center space-x-2 text-xs text-gray-600">
                <Shield className="h-3 w-3 text-[#5B2C90]" />
                <span>Acceso mediante Supabase Auth</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-gray-600 text-sm mt-6">
          Sistema de Gestión de Restaurante • <span className="font-bold bg-gradient-to-r from-[#0B2240] to-[#5B2C90] bg-clip-text text-transparent">SIREST v2.0</span>
        </p>
        </div>
      </div>
    </div>
  );
}
