import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ActivatePlanScreen } from './screens/ActivatePlan/ActivatePlanScreen';
import { CompositionScreen } from './screens/Composition/CompositionScreen';
import { DiscoveryScreen } from './screens/Discovery/DiscoveryScreen';
import { LandingScreen } from './screens/Landing/LandingScreen';
import { InterpretationScreen } from './screens/Interpretation/InterpretationScreen';
import { OperationScreen } from './screens/Operation/OperationScreen';
import { PurchaseReviewScreen } from './screens/PurchaseReview/PurchaseReviewScreen';
import { ShowcaseScreen } from './screens/Showcase/ShowcaseScreen';
import { MockWalletProvider } from './wallet/MockWalletProvider';

export function App() {
  return (
    <MockWalletProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingScreen />} />
          <Route path="/start" element={<DiscoveryScreen />} />
          <Route path="/interpretations/:id" element={<InterpretationScreen />} />
          <Route path="/proposals/:id" element={<CompositionScreen />} />
          <Route path="/plans/:id/activate" element={<ActivatePlanScreen />} />
          <Route path="/operations/:id/review" element={<PurchaseReviewScreen />} />
          <Route path="/operations/:id" element={<OperationScreen />} />
          {import.meta.env.DEV && <Route path="/showcase" element={<ShowcaseScreen />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </MockWalletProvider>
  );
}
