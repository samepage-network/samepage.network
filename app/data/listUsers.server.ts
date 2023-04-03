import { users } from "@clerk/clerk-sdk-node";
import { getPrimaryEmailFromUser } from "./getPrimaryUserEmail.server";

const listUsers = async (
  searchParams: Record<string, string> = {}
) => {
  const index = Number(searchParams["index"] || "1") - 1;
  const size = Number(searchParams["size"]) || 10;
  const search = searchParams["search"] || "";
  const data = await users.getUserList({
    limit: size,
    offset: index * size,
    emailAddress: search ? [search] : undefined,
  });
  const count = await users.getCount({
    emailAddress: search ? [search] : undefined,
  })
  return {
    columns: [
      { Header: "Email", accessor: "email" },
      { Header: "Name", accessor: "name" },
    ],
    count,
    data: data.map((d) => ({
      id: d.id,
      email: getPrimaryEmailFromUser(d),
      name: `${d.firstName} ${d.lastName}`,
    })),
  };
};

export default listUsers;
