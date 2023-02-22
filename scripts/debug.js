const mysql = require("mysql2/promise");

mysql
  .createConnection("mysql://root:root@localhost:3306/samepage_network")
  .then((con) => {
    con.destroy();
    console.log("WE CAN CONNECT!");
  })
  .catch((e) => {
    console.error("WE COULDN'T CONNECT!");
    throw e;
  });
