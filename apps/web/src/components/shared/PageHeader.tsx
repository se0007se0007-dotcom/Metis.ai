'use client';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6 pt-4 px-6">
      <div>
        <h1 className="text-2xl font-extrabold text-dark">{title}</h1>
        {description && (
          <p className="text-sm text-muted-dark mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
