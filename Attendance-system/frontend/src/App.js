import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SchedulerProvider }     from "./context/SchedulerContext";
import Layout             from "./components/Layout";
import Login              from "./pages/Login";
import ProfessorDashboard from "./pages/ProfessorDashboard";
import CoursesPage        from "./pages/CoursesPage";
import CourseView         from "./pages/CourseView";
import Analytics          from "./pages/Analytics";
import AdminDashboard     from "./pages/AdminDashboard";
import AdminOverview      from "./pages/AdminOverview";
import Students           from "./pages/Students";

function AppContent() {
  const { user }               = useAuth();
  const [page, setPage]        = useState("dashboard");
  const [activeCourse, setActiveCourse] = useState(null);

  // Reset page and active course whenever the logged-in user changes.
  useEffect(() => {
    setPage("dashboard");
    setActiveCourse(null);
  }, [user?.user_id]);

  if (!user) return <Login />;

  const handleSetPage = (p) => {
    setPage(p);
    if (p !== "courses") setActiveCourse(null);
  };

  // TAs and profs share the same dashboard view
  const isProfOrTa = user.role === "prof" || user.role === "ta";

  if (page === "courses" && activeCourse) {
    return (
      <Layout page={page} setPage={handleSetPage}>
        <CourseView
          course={activeCourse}
          goBack={() => { setActiveCourse(null); }}
        />
      </Layout>
    );
  }

  return (
    <Layout page={page} setPage={handleSetPage}>
      {user.role === "admin" ? (
        <>
          {page === "dashboard" && <AdminOverview />}
          {page === "analytics" && <Analytics />}
          {page === "admin"     && <AdminDashboard />}
        </>
      ) : isProfOrTa ? (
        <>
          {page === "dashboard" && (
            <ProfessorDashboard setPage={handleSetPage} setActiveCourse={setActiveCourse} />
          )}
          {page === "courses" && (
            <CoursesPage setActiveCourse={setActiveCourse} />
          )}
          {page === "students"  && <Students />}
          {page === "analytics" && <Analytics />}
        </>
      ) : null /* student role — mobile app only */ }
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SchedulerProvider>
        <AppContent />
      </SchedulerProvider>
    </AuthProvider>
  );
}