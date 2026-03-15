import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="ml-[260px] min-h-screen">
        <div className="max-w-[1100px] mx-auto px-8 py-7">{children}</div>
      </main>
    </div>
  );
}
