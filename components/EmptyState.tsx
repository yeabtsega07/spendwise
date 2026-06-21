import Icon, { type IconName } from "./Icon";

export default function EmptyState({
  icon,
  title,
  sub,
}: {
  icon: IconName;
  title: string;
  sub?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <span className="empty-title">{title}</span>
      {sub && <span className="empty-sub">{sub}</span>}
    </div>
  );
}
