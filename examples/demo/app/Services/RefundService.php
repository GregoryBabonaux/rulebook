<?php
class RefundService
{
    public function approve($refund, $user)
    {
        if ($refund->amount > 500 && ! $user->isAdmin()) {
            throw new AuthorizationException('Refund above 500 needs an admin');
        }
        return $refund->markApproved($user);
    }
}
