<?php
class RefundTest {
    public function test_refund_refused_after_window() {
        $this->assertFalse(refund(15));
    }
}
