import React from "react";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type LogProps = { month: number; year: number; html: string };

const MonthLog = ({ month, year, html }: LogProps) => {
  const [show, setShow] = React.useState(true);
  return (
    <div>
      <h3
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => setShow(!show)}
      >
        {months[month]} {year}
      </h3>
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ display: show ? "block" : "none" }}
      />
    </div>
  );
};

const DailyLog = (props: { allContent: LogProps[] }): React.ReactElement => {
  return (
    <div>
      {props.allContent.map((logProps) => (
        <MonthLog {...logProps} key={`${logProps.year}-${logProps.month}`} />
      ))}
    </div>
  );
};

export default DailyLog;
