module.exports=[8844,T=>T.a(async(E,L)=>{try{let E=await T.y("pg-4c0d8067d674414d");T.n(E),L()}catch(T){L(T)}},!0),62294,T=>T.a(async(E,L)=>{try{var e=T.i(8844),N=E([e]);[e]=N.then?(await N)():N;let t=!!process.env.REPL_ID,A=new e.Pool({connectionString:process.env.DATABASE_URL,ssl:!t&&{rejectUnauthorized:!1},max:10,connectionTimeoutMillis:5e3,idleTimeoutMillis:3e4}),a=!1;async function s(){a||(await A.query(`
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
    CREATE TABLE IF NOT EXISTS mednexus_notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      admin_only BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE mednexus_notifications ADD COLUMN IF NOT EXISTS admin_only BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE TABLE IF NOT EXISTS mednexus_assessments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      module_name TEXT NOT NULL,
      question_ids JSONB NOT NULL DEFAULT '[]',
      question_count INTEGER NOT NULL DEFAULT 10,
      time_limit_mins INTEGER NOT NULL DEFAULT 30,
      tries_allowed INTEGER NOT NULL DEFAULT 1,
      pass_mark INTEGER NOT NULL DEFAULT 50,
      status TEXT NOT NULL DEFAULT 'offline',
      share_token TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_assessment_attempts (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      is_guest BOOLEAN NOT NULL DEFAULT false,
      answers JSONB NOT NULL DEFAULT '{}',
      score INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      submitted_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS mednexus_registered_users (
      uid TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT '',
      index_number TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
      otp_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `),a=!0)}T.s(["default",0,A,"ensureSchema",0,s]),L()}catch(T){L(T)}},!1)];

//# sourceMappingURL=%5Broot-of-the-server%5D__0jpb72e._.js.map