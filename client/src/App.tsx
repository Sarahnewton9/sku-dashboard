import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      {/* Redirect bare root to /overview */}
      <Route path="/">
        <Redirect to="/overview" />
      </Route>
      {/* Each tab gets its own URL */}
      <Route path="/overview" component={Dashboard} />
      <Route path="/categories" component={Dashboard} />
      <Route path="/styles" component={Dashboard} />
      <Route path="/leathers" component={Dashboard} />
      <Route path="/colours" component={Dashboard} />
      <Route path="/colourleather" component={Dashboard} />
      <Route path="/expansion" component={Dashboard} />
      <Route path="/buy-sessions" component={Dashboard} />
      <Route path="/buy-analysis" component={Dashboard} />
      <Route path="/last-approval" component={Dashboard} />
      <Route path="/fitting" component={Dashboard} />
      <Route path="/specs" component={Dashboard} />
      <Route path="/season-analysis" component={Dashboard} />
      <Route path="/markdown" component={Dashboard} />
      <Route path="/handbags" component={Dashboard} />
      <Route path="/404" component={NotFound} />
      {/* Any unknown path redirects to overview rather than 404 */}
      <Route>
        <Redirect to="/overview" />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="bottom-right" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
