import apiClient from "../internal/apiClient";
import { ListNotebooks } from "../internal/types";

const listNotebooks: ListNotebooks = () =>
  apiClient({ method: "list-recent-notebooks" });

export default listNotebooks;
