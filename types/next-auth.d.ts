import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      loginType: string;
      companyId: string;
      companyName: string;
      policyNumber: string;
      prognosisToken: string;
    };
  }

  interface User {
    role?: string;
    loginType?: string;
    companyId?: string;
    companyName?: string;
    policyNumber?: string;
    prognosisToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    loginType?: string;
    companyId?: string;
    companyName?: string;
    policyNumber?: string;
    prognosisToken?: string;
  }
}
