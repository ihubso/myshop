const currentMonthIndex = (/* @__PURE__ */ new Date()).getMonth();
console.log("Starting code checkert and wiat for payment server........................................................................................");
const monthDetails = [
  { name: "January", link: "https://selar.com/rp47866744", codes: [
    "JAN-52623-SEC-4324",
    "JAN-26838-SEC-5245",
    "JAN-77797-SEC-4439",
    "JAN-36161-SEC-6472",
    "JAN-81022-SEC-5307"
  ] },
  { name: "February", link: "https://selar.com/d116a85645", codes: [
    "FEB-24288-SEC-8360",
    "FEB-35468-SEC-6244",
    "FEB-81815-SEC-5104",
    "FEB-70442-SEC-4208",
    "FEB-77618-SEC-1593"
  ] },
  { name: "March", link: "https://selar.com/668fh76w31", codes: [
    "MAR-95477-SEC-5275",
    "MAR-25912-SEC-5075",
    "MAR-31243-SEC-6973",
    "MAR-82106-SEC-2687",
    "MAR-21434-SEC-3600"
  ] },
  { name: "April", link: "https://selar.com/c378674589", codes: [
    "APR-38219-SEC-7832",
    "APR-53247-SEC-9346",
    "APR-54181-SEC-8784",
    "APR-38041-SEC-1200",
    "APR-49577-SEC-4122"
  ] },
  { name: "May", link: "https://selar.com/727m86p728", codes: [
    "MAY-10017-SEC-8919",
    "MAY-46602-SEC-4837",
    "MAY-57737-SEC-5320",
    "MAY-68988-SEC-2089",
    "MAY-61039-SEC-2906"
  ] },
  { name: "June", link: "https://selar.com/0v38z806m1", codes: [
    "JUN-39203-SEC-3248",
    "JUN-42156-SEC-3471",
    "JUN-64452-SEC-8270",
    "JUN-30281-SEC-1825",
    "JUN-89062-SEC-2573"
  ] },
  { name: "July", link: "https://selar.com/ens6sc6662", codes: [
    "JUL-30872-SEC-2288",
    "JUL-55028-SEC-5019",
    "JUL-28703-SEC-1873",
    "JUL-31612-SEC-1039",
    "JUL-30677-SEC-3083"
  ] },
  { name: "August", link: " https://selar.com/381e6g756u", codes: [
    "AUG-17014-SEC-9149",
    "AUG-42077-SEC-2509",
    "AUG-13344-SEC-2246",
    "AUG-89937-SEC-4275",
    "AUG-68311-SEC-3755"
  ] },
  { name: "September", link: "https://selar.com/3r0v4e38y6", codes: [
    "SEP-91143-SEC-6469",
    "SEP-65866-SEC-8462",
    "SEP-58164-SEC-9706",
    "SEP-31296-SEC-5496",
    "SEP-10020-SEC-4889"
  ] },
  { name: "October", link: "https://selar.com/840p76e481", codes: [
    "OCT-54333-SEC-3753",
    "OCT-14855-SEC-5990",
    "OCT-64189-SEC-1287",
    "OCT-59769-SEC-5762",
    "OCT-23073-SEC-8126"
  ] },
  { name: "November", link: "https://selar.com/a4j44585xl", codes: [
    "NOV-57797-SEC-7987",
    "NOV-69034-SEC-1627",
    "NOV-76774-SEC-1901",
    "NOV-64152-SEC-9950",
    "NOV-44133-SEC-4566"
  ] },
  { name: "December", link: "https://selar.com/6388188065", codes: [
    "DEC-83708-SEC-8963",
    "DEC-54363-SEC-4403",
    "DEC-70047-SEC-8209",
    "DEC-13378-SEC-2188",
    "DEC-39386-SEC-8544"
  ] }
];
const yearlyData = { name: "Full Year", link: "https://selar.com/611u0188x6", codes: [
  "YEAR-94994-SEC-2004",
  "YEAR-84846-SEC-8472",
  "YEAR-47669-SEC-9991",
  "YEAR-59206-SEC-2875",
  "YEAR-79645-SEC-3659"
] };
