<?php
class OrderPolicy
{
    public function view($user, $order)
    {
        return $user->id === $order->user_id;
    }

    public function refund($user, $order)
    {
        return $order->delivered_at
            && $order->delivered_at->diffInDays(now()) <= 14;
    }
}
