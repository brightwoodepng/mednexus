module.exports=[8844,e=>e.a(async(T,E)=>{try{let T=await e.y("pg-4c0d8067d674414d");e.n(T),E()}catch(e){E(e)}},!0),62294,e=>e.a(async(T,E)=>{try{var a=e.i(8844),t=T([a]);[a]=t.then?(await t)():t;let i=!!process.env.REPL_ID,s=new a.Pool({connectionString:process.env.DATABASE_URL,ssl:!i&&{rejectUnauthorized:!1},max:10,connectionTimeoutMillis:5e3,idleTimeoutMillis:3e4}),A=!1;async function n(){A||(await s.query(`
    CREATE TABLE IF NOT EXISTS mednexus_users (
      uid TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Clinician',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_progress (
      uid TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_questions (
      id INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `),A=!0)}e.s(["default",0,s,"ensureSchema",0,n]),E()}catch(e){E(e)}},!1)];

//# sourceMappingURL=%5Broot-of-the-server%5D__0jpb72e._.js.map