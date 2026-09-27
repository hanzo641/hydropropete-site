import { IRL_VALUES, formatQuarter } from "./irl";

export const quarterOptions = () =>
  IRL_VALUES.map((e) => ({ quarter: e.quarter, label: `${formatQuarter(e.quarter)} — ${e.value.toFixed(2).replace(".", ",")}` }));
