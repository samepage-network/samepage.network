import React from "react";

const InlineBlockReference = ({
  blockReferences,
}: {
  blockReferences: { title: string; uid: string }[];
}): React.ReactElement => {
  return (
    <div
      style={{
        backgroundColor: "#F5F8FA",
        paddingLeft: 20,
        fontSize: 12,
      }}
    >
      {blockReferences.map(({ title, uid }) => (
        <div key={uid}>{title}</div>
      ))}
    </div>
  );
};

export default InlineBlockReference;
