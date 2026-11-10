import { render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { WideLayoutControl } from "./wide-layout-control";
afterEach(() => vi.unstubAllEnvs());
test("Fleet exposes no second upstream sidebar-layout setting", () => {
  vi.stubEnv("VITE_HERDR_FLEET", "1");
  const view = render(<WideLayoutControl />);
  expect(view.container).toBeEmptyDOMElement();
});
