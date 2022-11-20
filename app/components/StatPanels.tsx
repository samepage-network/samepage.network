const StatPanels = ({
  stats,
  order,
}: {
  stats: Record<string, number>;
  order: string[];
}) => (
  <div className="flex gap-2 mb-12 items-center">
    {Object.entries(stats)
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([title, stat]) => (
        <div
          className="rounded-3xl shadow-2xl bg-amber-200 p-4 flex-1"
          key={title}
        >
          <h4 className="font-semibold capitalize mb-2">{title}</h4>
          <p className="text-sky-800">{stat}</p>
        </div>
      ))}
  </div>
);

export default StatPanels;
