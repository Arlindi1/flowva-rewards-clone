import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

export default function App() {
  const [status, setStatus] = useState("Checking...");
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
if (ref) {
  localStorage.setItem("referral_code", ref);
}


  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) setStatus("Supabase error: " + error.message);
      else setStatus("Supabase OK ✅ (session: " + (data.session ? "yes" : "no") + ")");
    })();
  }, []);

  return <div style={{ padding: 24, fontSize: 18 }}>{status}</div>;
}
