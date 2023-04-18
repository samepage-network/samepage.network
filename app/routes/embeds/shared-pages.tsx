import React from "react";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const SharedPagesEmbedPage: React.FC = () => {
  return (
    <div>
      TODO: List Currently shared pages and allow for sharing of new page.
      <ul>
        <li>
          Also allow for unauthenticated users to enter their notebook creds,
          then redirect with the searchParams defined.
        </li>
        <li>Move to single auth=Base64(uuid:token) param</li>
      </ul>
    </div>
  );
};

export default SharedPagesEmbedPage;
