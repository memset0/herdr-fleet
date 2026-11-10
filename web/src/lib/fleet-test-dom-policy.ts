import { configure } from "@testing-library/dom";

// Large state galleries and marks can settle slowly on shared CI; assertions remain unchanged.
configure({ asyncUtilTimeout: 5000 });
