import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {ErrorBoundary, LocationProvider, Route, Router} from 'preact-iso';

import HomePage from './pages/HomePage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';

// App admin page: Home (how to use the app) and Settings (copy and Shopify
// settings). The app name in the sidebar is the Home link, so the nav only
// lists Settings.
export default async () => {
  render(<App />, document.body);
};

function App() {
  return (
    <LocationProvider>
      <s-app-nav>
        <s-link href="/settings">Settings</s-link>
      </s-app-nav>
      <ErrorBoundary>
        <Router>
          <Route path="/" component={HomePage} />
          <Route path="/settings" component={SettingsPage} />
          <Route default component={HomePage} />
        </Router>
      </ErrorBoundary>
    </LocationProvider>
  );
}
