const columns = [
  { Header: "Name", accessor: "name" },
  { Header: "Phone Number", accessor: "phone" },
];

// TODO: Implement this function
const listAssistantsForUser = async () => {
  return {
    columns,
    count: 3,
    data: [
      { name: "John Doe", phone: "555-555-5555" },
      { name: "Jane Doe", phone: "555-555-5555" },
      { name: "John Smith", phone: "555-555-5555" },
    ],
    error: "",
  };
};

export default listAssistantsForUser;
