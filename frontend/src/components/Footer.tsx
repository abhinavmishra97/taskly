export default function Footer() {
  return (
    <footer className="app-footer">
      <p>
        © {new Date().getFullYear()} <strong>Taskly</strong>. Simple task management.
      </p>
    </footer>
  );
}
