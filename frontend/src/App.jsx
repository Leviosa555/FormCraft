import AppRoutes from "./routes/AppRoutes";
import { Toaster } from "sonner";
import { I18nProvider } from "./lib/i18n";

function App() {
  return (
    <I18nProvider>
      <AppRoutes />
      <Toaster
        position="top-right"
        richColors
        closeButton
      />
    </I18nProvider>
  );
}

export default App;