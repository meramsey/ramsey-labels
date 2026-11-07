<?php
use PHPUnit\Framework\TestCase;
use RamseyLabels\Schema;
use RamseyLabels\Data;
final class SchemaTest extends TestCase {
    public function testHugeIntegerCannotWrapNegative() : void {
        self::assertSame(PHP_INT_MAX, Schema::number(PHP_INT_MAX, 1, PHP_INT_MAX, true));
        $this->expectException(InvalidArgumentException::class);
        Schema::number((float)PHP_INT_MAX, 1, PHP_INT_MAX, true);
    }
    public function testFactoryLibraryValidates() : void {
        $library = Schema::library(Schema::defaults());
        self::assertSame(1, $library['schema']);
        self::assertEquals(50.8, $library['profiles'][0]['design']['width']);
        self::assertEquals(25.4, $library['profiles'][0]['design']['height']);
    }
    /** @dataProvider invalidNumbers */
    public function testRejectsInvalidNumbers($value) : void {
        $this->expectException(InvalidArgumentException::class);
        Schema::number($value, 1, 2000, true);
    }
    public static function invalidNumbers() : array {
        return [[0], [-1], [2001], [1.2], [INF], [NAN], ['1 OR 1=1'], [[]]];
    }
    public function testIdsAreValidatedAndDeduplicated() : void {
        self::assertSame([12, 34], Data::ids('12,34;12'));
    }
    public function testPrototypeFieldsRejected() : void {
        $this->expectException(InvalidArgumentException::class);
        Data::fieldKeys(['__proto__']);
    }
    public function testBatchLimitEnforced() : void {
        $this->expectException(InvalidArgumentException::class);
        Schema::records([['key'=>'a','values'=>[], 'quantity'=>2000], ['key'=>'b','values'=>[], 'quantity'=>1]]);
    }
    public function testOutOfBoundsElementRejected() : void {
        $design = Schema::defaults()['profiles'][0]['design'];
        $design['elements'][0]['x'] = 500;
        $this->expectException(InvalidArgumentException::class);
        Schema::design($design);
    }
    public function testRollGeometryNormalizesSheetSettings() : void {
        $design = Schema::defaults()['profiles'][0]['design'];
        $page = Schema::page(['mode'=>'roll', 'columns'=>4, 'start'=>3], $design);
        self::assertSame(1, $page['columns']);
        self::assertSame(0, $page['start']);
        self::assertEquals(50.8, $page['width']);
    }
    public function testElementsAcceptOnlyExplicitTextDirections() : void {
        $element=Schema::defaults()['profiles'][0]['design']['elements'][0];
        self::assertSame('inherit', Schema::element($element)['direction']);
        $element['direction']='rtl';self::assertSame('rtl',Schema::element($element)['direction']);
        $element['direction']='auto';$this->expectException(InvalidArgumentException::class);Schema::element($element);
    }
}
