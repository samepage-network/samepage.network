import { useState } from "react";
import CreateUsername from "package/components/CreateUsername";
import Button from "@dvargas92495/app/components/Button";

const CreateUsernamePage = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button type={"button"} onClick={() => setIsOpen(true)}>
        Create Username
      </Button>
      <CreateUsername
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
};

export default CreateUsernamePage;
