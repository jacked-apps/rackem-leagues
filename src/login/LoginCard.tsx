import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';

interface LoginCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export const LoginCard: React.FC<LoginCardProps> = ({ title, description, children }) => {
  return (
    <Card className="w-full lg:w-1/2 lg:mx-auto mt-25 p-4 lg:shadow-lg lg:bg-muted">
      <CardHeader>
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
};
