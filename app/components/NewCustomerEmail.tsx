import EmailLayout from "../../package/components/EmailLayout";
import React from "react";

const NewCustomerEmail = ({ email }: { email: string }): React.ReactElement => (
  <EmailLayout>
    <div style={{ marginBottom: 16 }}>There's a new client on SamePage!</div>
    <div>
      New client could be reached at {email}. Here are the next steps to take:
      <ol>
        <li>
          Make sure that their Stripe customer account and their Clerk user
          account are linked.
        </li>
        <li>
          Make sure that they know how to install the SamePage extension on
          their favorite applications.
        </li>
        <li>
          Figure out how they could start creating their backlog of tasks on
          their application of choice and how they could share it with your Roam
          Graph.
        </li>
      </ol>
    </div>
  </EmailLayout>
);

export default NewCustomerEmail;
