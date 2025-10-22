import { render } from '@testing-library/react';
import App from './App';

test('renders App without crashing', () => {
  render(<App />);
  // Basic test to ensure the app renders without throwing errors
  expect(document.body).toBeInTheDocument();
});
