import apiClient from "package/internal/apiClient";
import { ListNotebooks } from "package/internal/types";

const listNotebooks: ListNotebooks = () =>
  apiClient({ method: "list-recent-notebooks" });

export default listNotebooks;
