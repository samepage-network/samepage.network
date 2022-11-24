import React from "react";

const EmailLayout = ({ children }: React.PropsWithChildren) => (
  <div
    style={{
      margin: "0 auto",
      maxWidth: 600,
      fontFamily: `"Proxima Nova","proxima-nova",Helvetica,Arial sans-serif`,
      padding: `20px 0`,
      minHeight: "100%",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <div
      style={{
        width: "80%",
        margin: "0 auto",
        paddingBottom: 20,
        borderBottom: "1px dashed #dadada",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <img height={40} src={`${process.env.ORIGIN}/images/logo.png`}></img>
    </div>
    <div
      style={{
        width: "80%",
        margin: "30px auto",
        fontSize: 16,
        flexGrow: 1,
      }}
    >
      {children}
    </div>
    <div
      style={{
        width: "80%",
        margin: "30px auto",
        borderTop: "1px dashed #dadada",
        display: "flex",
        color: "#a8a8a8",
        paddingTop: 15,
      }}
    >
      <div style={{ width: "50%" }}>
        Sent From{" "}
        <a
          href={process.env.ORIGIN}
          style={{ color: "#4d9bd7", textDecoration: "none" }}
        >
          SamePage
        </a>
      </div>
      <div style={{ width: "50%", textAlign: "right" }}>
        <a
          href={`mailto:support@${process.env.ORIGIN}`}
          style={{ color: "#4d9bd7", textDecoration: "none" }}
        >
          Contact Support
        </a>
      </div>
    </div>
  </div>
);

const InviteCodeEmail = ({ code }: { code: string }) => (
  <EmailLayout>
    <div style={{ marginBottom: 16 }}>Welcome to SamePage!</div>
    <div>
      Here is your invite code. It expires one week from today. Enter it during
      the onboarding process after installing the SamePage extension into your
      tool for thought:
    </div>
    <div
      style={{
        marginTop: 16,
        marginBottom: 16,
      }}
    >
      <code
        style={{
          padding: 4,
          background: "#EEEEEE",
          borderRadius: 8,
        }}
      >
        {code}
      </code>
    </div>
    <div>
      If you need help getting set up, be sure to visit our docs by{" "}
      <a
        href="https://samepage.network/docs"
        style={{ color: "rgb(56, 189, 248)", textDecoration: "underline" }}
      >
        clicking here.
      </a>
    </div>
    <div style={{ marginTop: 16 }}>Happy collaborating!</div>
  </EmailLayout>
);

export default InviteCodeEmail;
