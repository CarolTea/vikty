import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { WalletContext, type Wallet } from '../../wallet/wallet';

export const ADDRESS = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

/** Renders a screen at `route` with a fake connected wallet; any other route shows its path. */
export function renderAt(element: ReactElement, route: string, pattern: string, wallet: Partial<Wallet> = {}) {
  const value: Wallet = {
    address: ADDRESS,
    token: 'token',
    connect: async () => undefined,
    disconnect: () => undefined,
    signTransaction: async (tx) => `signed:${tx}`,
    ...wallet,
  };
  return render(
    <WalletContext.Provider value={value}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={pattern} element={element} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </WalletContext.Provider>,
  );
}

function LocationProbe() {
  return <p data-testid="elsewhere">{useLocation().pathname}</p>;
}
