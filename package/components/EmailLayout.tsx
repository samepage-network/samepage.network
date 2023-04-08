import React from "react";

const EmailLayout = ({ children }: React.PropsWithChildren) => (
  <div
    style={{
      margin: "0 auto",
      maxWidth: 600,
      fontFamily: `"Proxima Nova","proxima-nova",Helvetica,Arial sans-serif`,
      padding: `20px 0`,
      minHeight: "100%",
    }}
  >
    <div
      style={{
        width: "80%",
        margin: "0 auto",
        paddingBottom: 20,
        borderBottom: "1px dashed #dadada",
      }}
    >
      <img
        height={120}
        src={`${process.env.ORIGIN}/images/logo.png`}
        style={{ margin: "auto", display: "block" }}
      />
    </div>
    <div
      style={{
        width: "80%",
        margin: "30px auto",
        fontSize: 16,
        minHeight: 400,
      }}
    >
      {children}
    </div>
    <div
      style={{
        width: "80%",
        margin: "30px auto",
        borderTop: "1px dashed #dadada",
        color: "#a8a8a8",
        paddingTop: 15,
      }}
    >
      <span style={{ width: "50%", display: "inline-block" }}>
        Sent From{" "}
        <a
          href={process.env.ORIGIN}
          style={{ color: "#4d9bd7", textDecoration: "none" }}
        >
          SamePage
        </a>
      </span>
      <span
        style={{ width: "50%", textAlign: "right", display: "inline-block" }}
      >
        <a
          href={`mailto:support@samepage.network`}
          style={{ color: "#4d9bd7", textDecoration: "none" }}
        >
          Contact Support
        </a>
      </span>
    </div>
  </div>
);

export default EmailLayout;
