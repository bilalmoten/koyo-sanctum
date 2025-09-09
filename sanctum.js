// Replace these with your Supabase credentials
const SUPABASE_URL = "https://iipodamyhiyidvrfggva.supabase.co";

// "postgresql://postgres:MbIJKfnxce235vaU@db.iipodamyhiyidvrfggva.supabase.co:5432/postgres";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcG9kYW15aGl5aWR2cmZnZ3ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNzkwMjUsImV4cCI6MjA3Mjk1NTAyNX0.3PvX1uIstWiw5lkwxm6aBjI3pJvFS0K8tJzWe0D3dU0";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentMember = null;

async function login() {
    const memberId = document.getElementById("member_id").value.trim();
    const giftCode = document.getElementById("gift_code").value.trim();

    if (!memberId || !giftCode) {
        alert("Please enter both Member ID and Gift Code.");
        return;
    }

    let { data, error } = await supabaseClient
        .from("members")
        .select("*")
        .eq("member_id", memberId)
        .eq("gift_code", giftCode)
        .single();

    if (error || !data) {
        alert("Invalid Member ID or Gift Code");
        return;
    }

    currentMember = data;

    document.getElementById("login").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    document.getElementById("memberLabel").innerText = memberId;
    document.getElementById("points").innerText = data.points;
}

async function redeem() {
    const code = document.getElementById("redeem_code").value.trim();

    if (!currentMember) {
        alert("You must log in first.");
        return;
    }
    if (!code) {
        alert("Please enter a scratch code.");
        return;
    }

    let { data: codeData, error } = await supabaseClient
        .from("codes")
        .select("*")
        .eq("code", code)
        .eq("used", false)
        .single();

    if (error || !codeData) {
        document.getElementById("redeemMessage").innerText = "Invalid or already used code.";
        document.getElementById("redeemMessage").style.color = "red";
        return;
    }

    // Mark code as used
    await supabaseClient
        .from("codes")
        .update({ used: true, member_id: currentMember.member_id })
        .eq("code", code);

    // Add points
    const newPoints = currentMember.points + codeData.points;
    await supabaseClient
        .from("members")
        .update({ points: newPoints })
        .eq("member_id", currentMember.member_id);

    currentMember.points = newPoints;
    document.getElementById("points").innerText = newPoints;
    document.getElementById("redeemMessage").innerText = `+${codeData.points} points added!`;
    document.getElementById("redeemMessage").style.color = "green";
}
