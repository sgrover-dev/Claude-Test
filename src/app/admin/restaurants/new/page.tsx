import { PageHeader, Panel } from "@/components/admin/ui";
import { RestaurantForm } from "@/components/admin/RestaurantForm";

export default function NewRestaurantPage() {
  return (
    <>
      <PageHeader title="New restaurant" back={{ href: "/admin/restaurants", label: "Restaurants" }} />
      <Panel>
        <RestaurantForm />
      </Panel>
    </>
  );
}
