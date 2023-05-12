const NoClerk = () => {
  return (
    <div className="max-w-sm mt-32">
      App was loaded without Clerk configured. To log into SamePage, set your{" "}
      <code className="bg-gray-200 px-2 py-1 rounded-sm">
        CLERK_PUBLISHABLE_KEY
      </code>{" "}
      environment variable locally
    </div>
  );
};

export default NoClerk;
