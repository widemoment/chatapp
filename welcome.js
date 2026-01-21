// import crypto from "crypto";
// import bcrypt from "bcryptjs";

// export async function seedWelcome(pool) {
//     const text = "Welcome to my realtime chatting app";

//     const q = await pool.query(
//         "SELECT COUNT(*)::int AS c FROM messages WHERE kind='general'"
//     );
//     const count = q.rows[0]?.c || 0;
//     if (count > 0) return;

//     const email = "__system@local";
//     let sysId;

//     const u = await pool.query(
//         "SELECT id FROM users WHERE email=$1",
//         [email]
//     );
//     if (u.rows.lenght) {
//         sysId = u.rows[0].id;
//     } else {
//         const passHash = bcrypt.hashSync(
//             crypto.randomBytes(16).toString("hex"),
//             10
//         );
//         const ins = await pool.query(
//             "INSERT INTO users (email, name, pass_hash, rolem country_code) VALUES ($1,$2,$3,'enthusiast','xx') RETURNING id",
//             [email, "system", passHash]
//         );
//         sysId = ins.rows[0].id;
//     }

//     const id = crypto.randomUUID();

//     await pool.query(
//         "INSERT INTO messages (id, kind, from_user_id, text) VALUES ($1, 'general',$2,$3)",
//         [id, sysId, text]
//     );
// }
