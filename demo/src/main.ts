import "rootcap/widget";
import { setupDemoForm } from "./demo-form";

setupDemoForm(
  document.getElementById("form") as HTMLFormElement,
  document.getElementById("result")!,
  document.getElementById("token")!,
  document.getElementById("error")!,
);
