import { describe, it, expect } from "vitest";
import { deploymentLabel, titleFor } from "../deploymentLabel";

describe("deploymentLabel", () => {
  it("says nothing on a production host", () => {
    expect(deploymentLabel("agent.thaink2.fr")).toBe("");
    expect(deploymentLabel("apowerb.com")).toBe("");
    expect(deploymentLabel("app.apowerb.com")).toBe("");
    expect(deploymentLabel("devon.thaink2.fr")).toBe(""); // "dev" inside a word is not a marker
  });

  it("names the non-production hosts by their first label", () => {
    expect(deploymentLabel("agent-dev.thaink2.fr")).toBe("agent-dev");
    expect(deploymentLabel("dev-apowerb.thaink2.fr")).toBe("dev-apowerb");
    expect(deploymentLabel("staging.apowerb.com")).toBe("staging");
    expect(deploymentLabel("app.uat.apowerb.com")).toBe("app-preprod");
  });

  it("recognises a local server, port and case included", () => {
    expect(deploymentLabel("localhost:3000")).toBe("local");
    expect(deploymentLabel("127.0.0.1:3100")).toBe("local");
    expect(deploymentLabel("AGENT-DEV.thaink2.fr")).toBe("agent-dev");
  });

  it("lets DEPLOYMENT_LABEL win, and survives a missing host", () => {
    expect(deploymentLabel("agent.thaink2.fr", "canary")).toBe("canary");
    expect(deploymentLabel("", "")).toBe("");
    expect(deploymentLabel(undefined)).toBe("");
    expect(deploymentLabel("203.0.113.7:3000")).toBe(""); // a bare IP says nothing
  });

  it("prefixes the title only when there is a label", () => {
    expect(titleFor("apowerb", "agent-dev")).toBe("agent-dev · apowerb");
    expect(titleFor("apowerb", "")).toBe("apowerb");
  });
});
