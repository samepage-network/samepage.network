const mysql = require("mysql2/promise");
const exec = require("child_process").execSync;

exec(
  `mysql -uroot -proot -hlocalhost -P3306 -Dsamepage_network -e "SHOW GLOBAL VARIABLES LIKE 'PORT';"`,
  { stdio: "inherit" }
);
console.log("RAN THE INLINE VERSION");
Promise.all([
  mysql
    .createConnection("mysql://root:root@localhost:3306/samepage_network")
    .then((con) => {
      con.destroy();
      console.log("WE CAN CONNECT!");
      return [];
    })
    .catch((e) => {
      console.error("WE COULDN'T CONNECT!");
      return [e];
    }),
  mysql
    .createConnection({
      user: "root",
      password: "root",
      host: "localhost",
      port: 3306,
      database: "samepage_network",
    })
    .then((con) => {
      con.destroy();
      console.log("WE CAN CONNECT!");
      return [];
    })
    .catch((e) => {
      console.error("WE COULDN'T CONNECT!");
      return [e];
    }),
]).then((f) => {
  const errs = f.flat();
  if (errs.length) {
    console.error(errs.length, "errors");
    throw errs;
  }
});
