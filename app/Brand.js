import Link from "next/link";
import CONTENT from "../content";

// The product name, with the last three letters in yellow when it ends in "EAT".
export default function Brand({ className = "brand" }) {
  const match = /^(.*)(EAT)$/.exec(CONTENT.brand);
  return (
    <Link className={className} href="/">
      {match ? (<>{match[1]}<span>{match[2]}</span></>) : CONTENT.brand}
    </Link>
  );
}
